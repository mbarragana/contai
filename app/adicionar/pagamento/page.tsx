"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import {
  CampoArquivo,
  CampoTexto,
  ErroCampo,
  Rotulo,
} from "@/app/_components/campos";
import { AfirmacaoObra, TelaTrocarObra } from "@/app/_components/obra";
import { Registrado } from "@/app/_components/registrado";
import { useSessao } from "@/app/_components/sessao";
import { useObraDoRegistro } from "@/app/_components/usar-obra-do-registro";
import {
  AppBar,
  Banner,
  Botao,
  BotaoLink,
  Card,
  Carregando,
  Corpo,
  EstadoErro,
  Passo,
  Rodape,
} from "@/app/_components/ui";
import {
  carregarDocumento,
  carregarPainel,
  classificarErro,
  criarPagamento,
  criarVinculos,
  garantirFavorecido,
  mensagemDeErro,
  subirParaAcervo,
} from "@/lib/data";
import {
  alocarCusto,
  ehDocumentoHabil,
  MOTIVO_OBRA_DIFERENTE,
  podeVincular,
  saldoDescobertoDaNota,
} from "@/lib/fiscal/vinculo";
import {
  formatarDocumento,
  soDigitos,
  tipoPorDocumento,
} from "@/lib/fiscal/identificacao";
import {
  MEIO_PAGAMENTO_AVULSO,
  STATUS_PAGAMENTO_AVULSO,
  anoCalendario,
  rotulosPagoSemNota,
  validarPagamentoAvulso,
  type EntradaPagamento,
  type ErroCampoPagamento,
} from "@/lib/fiscal/pagamento";
import { hojeIso } from "@/lib/hoje";
import { centavosParaInput, formatarBRL, parseValorInput } from "@/lib/money";
import type { Documento, TipoFavorecido } from "@/lib/types";

type Fase =
  | { nome: "formulario" }
  | { nome: "salvando" }
  | {
      nome: "salvo";
      ano: number;
      tipoFavorecido: TipoFavorecido | null;
      id: string;
      obraNome: string;
      /**
       * Critério 1: o pagamento salvou e o VÍNCULO falhou. Não existe
       * transação pelo PostgREST entre duas tabelas, então este caso é real —
       * e a tela tem de dizer que o pagamento ficou SEM VÍNCULO.
       */
      vinculoFalhou: boolean;
      documentoDeOrigemId: string | null;
      /**
       * Critério 11: quando o vínculo não nasceu, POR QUÊ. Obra diferente tem
       * motivo próprio e ação própria (corrigir a obra de um dos dois) — o
       * `catch` cru engolia isso e a tela dizia só "ficou SEM VÍNCULO".
       */
      motivoSemVinculo: string | null;
    };

const NOME_TIPO = {
  nf_material: "NF de material",
  nf_servico: "NF de serviço",
  boleto: "Boleto",
} as const;

/**
 * De onde saiu o número do campo Valor. Rótulo curto e literal — o campo
 * preenchido pelo app sem dizer a origem lê como algo já conferido, e não foi.
 */
const ROTULO_VALOR_DA_NOTA = "valor da nota";
const ROTULO_FALTA_DA_NOTA = "falta desta nota";

function RegistrarPagamento() {
  // Mesma regra do documento: obra afirmada na tela, trocável aqui, e é ela
  // que grava o `obra_id` (critérios 6, 7 e 16).
  const registro = useObraDoRegistro();
  const { pedirReautenticacao } = useSessao();
  const obra = registro.obra;
  const [trocando, setTrocando] = useState(false);
  const [fase, setFase] = useState<Fase>({ nome: "formulario" });
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  // Mock s3b — "registrar o pagamento agora, já ligado": o documento de origem
  // vem na query string de quem mandou para cá (a tela da nota ou o seletor).
  // `useSearchParams` e não `window.location` no primeiro render: chegando por
  // navegação client-side, o `location` ainda não tem a query e o vínculo
  // desapareceria sem aviso — que é a classe de silêncio que este ticket veio
  // matar. O custo é a fronteira de Suspense no fim do arquivo.
  const documentoNaUrl = useSearchParams().get("documento");
  const [documentoDeOrigemId, setDocumentoDeOrigemId] = useState<string | null>(
    documentoNaUrl,
  );
  const [documentoDeOrigem, setDocumentoDeOrigem] = useState<Documento | null>(
    null,
  );

  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hojeIso);
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [erros, setErros] = useState<ErroCampoPagamento[]>([]);
  /**
   * O valor que veio da nota, guardado para a tela poder DIZER de onde ele
   * saiu. A ajuda só aparece enquanto o campo continua com esse número: no
   * instante em que o Mateus digita outro, o texto some — rótulo que sobrevive
   * à edição vira mentira sobre a origem do número.
   */
  const [sugestaoValor, setSugestaoValor] = useState<{
    texto: string;
    rotulo: string;
  } | null>(null);

  useEffect(() => {
    if (!documentoDeOrigemId) return;
    let cancelado = false;

    /**
     * O VALOR também vem da nota, e vem como SALDO — o que ainda falta pagar
     * dela, nunca o valor cheio de novo (decisão do Mateus, 2026-08-18: a
     * empreiteira emite nota por medição, e o pagamento costuma bater com ela).
     *
     * Quem calcula é `saldoDescobertoDaNota`, LEITURA da mesma alocação que
     * produz o número da home — não existe segunda conta de "quanto falta
     * nesta nota". Repetir o valor cheio na segunda parcela dobraria o custo,
     * que é a única direção de erro que gera passivo tributário (parecer §4).
     *
     * Nota sem valor, não hábil ou já coberta por inteiro não sugere nada:
     * campo vazio pergunta, campo preenchido afirma.
     */
    async function preencherValorDaNota(nota: Documento) {
      try {
        // O painel é o da obra DA NOTA: o saldo dela sai dos pagamentos já
        // ligados a ela, e nada soma entre obras.
        const painel = await carregarPainel(nota.obraId);
        if (cancelado) return;
        const saldo = saldoDescobertoDaNota(nota, alocarCusto(painel));
        if (saldo === null) return;
        const texto = centavosParaInput(saldo);
        setSugestaoValor({
          texto,
          rotulo:
            saldo === nota.valorCentavos
              ? ROTULO_VALOR_DA_NOTA
              : ROTULO_FALTA_DA_NOTA,
        });
        setValor((atual) => atual || texto);
      } catch {
        // Painel que não carrega deixa o campo vazio, e nada além disso: o
        // valor é digitável, e o registro do dispêndio não pode depender dele.
      }
    }

    void (async () => {
      try {
        const carregado = await carregarDocumento(documentoDeOrigemId);
        if (cancelado) return;
        setDocumentoDeOrigem(carregado);
        // NOME e CNPJ/CPF vêm da nota porque é o MESMO favorecido, e ele já
        // existe no banco com esse documento. Não é (só) para poupar
        // digitação: a dedup de `garantirFavorecido` é pela chave
        // (dono, DOCUMENTO), então um dígito trocado na redigitação cria um
        // SEGUNDO favorecido, e a ficha Pagamentos Efetuados sairia com a
        // mesma empresa em duas linhas. Nenhum dos dois sobrescreve o que já
        // está no campo — o dedo do Mateus vence o carregamento.
        setNome((atual) => atual || (carregado.favorecidoNome ?? ""));
        setDocumento(
          (atual) =>
            atual || formatarDocumento(carregado.favorecidoDocumento ?? ""),
        );
        await preencherValorDaNota(carregado);
      } catch {
        // Documento que não abre não pode travar o registro do pagamento: o
        // dispêndio é o fato, e ele tem de entrar. O vínculo se faz depois.
        if (!cancelado) setDocumentoDeOrigemId(null);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [documentoDeOrigemId]);

  const entrada: EntradaPagamento = useMemo(
    () => ({
      favorecidoNome: nome,
      favorecidoDocumento: documento,
      valorCentavos: parseValorInput(valor),
      dataPagamento: data || null,
      temComprovante: comprovante !== null,
    }),
    [nome, documento, valor, data, comprovante],
  );

  const erroDe = (campo: ErroCampoPagamento["campo"]) =>
    erros.find((e) => e.campo === campo)?.mensagem;

  /**
   * Critério 11 conferido ANTES do salvar, e não no `catch`: chegando por
   * `?documento=` de uma nota da obra B com a preferência do aparelho na obra
   * A, o vínculo é impossível — e o Mateus tem de saber disso enquanto ainda
   * pode trocar a obra desta tela, não depois de gravar.
   */
  const permissaoVinculo =
    documentoDeOrigem && obra
      ? podeVincular({ obraId: obra.id }, documentoDeOrigem)
      : null;
  const obraDivergente = permissaoVinculo !== null && !permissaoVinculo.ok;

  // PF não emite NF: o que sustenta o custo dele é o recibo assinado. Os
  // rótulos acompanham o CNPJ/CPF digitado, em vez de assumir PJ.
  const tipoFavorecido = useMemo(
    () => tipoPorDocumento(documento),
    [documento],
  );

  async function salvar() {
    const encontrados = validarPagamentoAvulso(entrada, hojeIso());
    setErros(encontrados);
    setErroSalvar(null);
    if (encontrados.length > 0 || !obra || !comprovante) return;

    setFase({ nome: "salvando" });
    try {
      if (tipoFavorecido === null) throw new Error("CNPJ/CPF inválido.");

      const comprovantePath = await subirParaAcervo(comprovante, "comprovante");
      const favorecidoId = await garantirFavorecido({
        nome: nome.trim(),
        documento: soDigitos(documento),
        tipo: tipoFavorecido,
      });

      // A obra que está na tela, não a preferência do aparelho.
      const id = await criarPagamento({
        obra_id: obra.id,
        favorecido_id: favorecidoId,
        valorCentavos: entrada.valorCentavos as number,
        data_pagamento: data,
        meio: MEIO_PAGAMENTO_AVULSO,
        // Cartão dependeria da Q4 (ano da compra vs. ano da fatura); PIX tem
        // uma data só.
        data_compra: null,
        comprovante_path: comprovantePath,
        status: STATUS_PAGAMENTO_AVULSO,
      });

      // O vínculo vem DEPOIS do pagamento e em outra chamada — não existe
      // transação entre duas tabelas pelo PostgREST, e não se inventa RPC para
      // fingir que existe. Se ele falhar, o pagamento continua salvo e a tela
      // diz que ficou SEM VÍNCULO, com o caminho para completar (critério 1).
      let vinculoFalhou = false;
      let motivoSemVinculo: string | null = null;
      if (documentoDeOrigem && obraDivergente) {
        // Nem tenta: o motivo é conhecido e é ele que vai para a tela.
        vinculoFalhou = true;
        motivoSemVinculo = MOTIVO_OBRA_DIFERENTE;
      } else if (documentoDeOrigem) {
        try {
          await criarVinculos([
            {
              pagamentoId: id,
              documentoId: documentoDeOrigem.id,
              obraDoPagamentoId: obra.id,
              obraDoDocumentoId: documentoDeOrigem.obraId,
              documentoHabil: ehDocumentoHabil(documentoDeOrigem),
            },
          ]);
        } catch (erroVinculo) {
          vinculoFalhou = true;
          motivoSemVinculo = mensagemDeErro(erroVinculo);
        }
      }

      setFase({
        nome: "salvo",
        ano: anoCalendario(data),
        tipoFavorecido,
        id,
        obraNome: obra.nome,
        vinculoFalhou,
        documentoDeOrigemId: documentoDeOrigem?.id ?? null,
        motivoSemVinculo,
      });
    } catch (erro) {
      setFase({ nome: "formulario" });
      // Sessão morta descoberta no "Salvar": sobreposto de reautenticação, e
      // NUNCA navegação. O formulário continua montado com comprovante, valor
      // e data — perder isso no canteiro é perder o registro, e custo não
      // comprovado não existe (IN SRF 84/2001 art. 17).
      if (classificarErro(erro).tipo === "sem_sessao") {
        pedirReautenticacao();
        return;
      }
      setErroSalvar(mensagemDeErro(erro));
    }
  }

  if (fase.nome === "salvo") {
    const salvos = rotulosPagoSemNota(fase.tipoFavorecido);
    const ligou = fase.documentoDeOrigemId !== null && !fase.vinculoFalhou;
    return (
      <Registrado
        ano={fase.ano}
        obraNome={fase.obraNome}
        hrefCorrigirObra={`/pagamento/${fase.id}/obra`}
        aviso={
          fase.vinculoFalhou ? (
            <>
              <strong>O pagamento foi salvo, mas ficou SEM VÍNCULO</strong> com
              a nota.{" "}
              {fase.motivoSemVinculo ? <>{fase.motivoSemVinculo} </> : null}
              Ele está registrado no acervo e conta como pago sem nota até você
              ligar os dois — abra o pagamento e use &quot;Ligar a uma
              nota&quot;.
            </>
          ) : undefined
        }
        proximoPasso={
          ligou ? (
            <>já ligado à nota — nada pendente aqui</>
          ) : (
            <>vincular {salvos.documento} quando chegar</>
          )
        }
        custo={
          ligou
            ? "conta pela data deste pagamento — regime de caixa"
            : `só conta depois de vincular ${salvos.documento}`
        }
      />
    );
  }

  const rotulos = rotulosPagoSemNota(tipoFavorecido);

  // Só enquanto o campo mostra o número que veio da nota (ver `sugestaoValor`).
  const ajudaValor =
    sugestaoValor && valor === sugestaoValor.texto
      ? `Vem da nota — ${sugestaoValor.rotulo}. Dá para trocar.`
      : undefined;

  // Tela 12 — troca sem sair do fluxo.
  if (trocando && obra) {
    return (
      <TelaTrocarObra
        obras={registro.obras}
        hoje={hojeIso()}
        onEscolher={(escolhida) => {
          registro.escolher(escolhida);
          setTrocando(false);
        }}
        onCancelar={() => setTrocando(false)}
      />
    );
  }

  return (
    <>
      <AppBar
        titulo="Registrar pagamento"
        sub={
          documentoDeOrigem && !obraDivergente
            ? `Já nasce ligado a ${formatarBRL(documentoDeOrigem.valorCentavos ?? 0)}`
            : "Interação 2 de 3 — comprovante obrigatório"
        }
      />

      <Corpo>
        {registro.fase === "carregando" ? (
          <Carregando rotulo="Carregando a obra" />
        ) : null}

        {registro.fase === "erro" ? (
          <EstadoErro
            erro={registro.erro ?? { tipo: "falha", mensagem: "" }}
            onTentarDeNovo={registro.recarregar}
          />
        ) : null}

        {registro.fase === "pronta" && obra ? (
          <>
            {erroSalvar ? (
              <Banner cor="red" role="alert">
                {erroSalvar}
              </Banner>
            ) : null}

            <AfirmacaoObra
              rotulo="Registrando em"
              nome={obra.nome}
              onTrocar={
                registro.obras.length > 1 ? () => setTrocando(true) : undefined
              }
            />

            {/* Critério 11 dito ANTES de salvar, com o motivo e a saída. */}
            {obraDivergente ? (
              <Banner cor="red" role="alert">
                <strong>Este pagamento não vai nascer ligado à nota.</strong>{" "}
                {MOTIVO_OBRA_DIFERENTE} Troque a obra desta tela ou desfaça o
                vínculo antes de salvar.
              </Banner>
            ) : null}

            {/* Mock s3b — o vínculo é afirmado na tela e desfazível ANTES de
                salvar: ninguém liga por engano o PIX à nota errada. */}
            {documentoDeOrigem ? (
              <Card>
                <div className="text-[13px]">
                  <strong>Ligado a:</strong>{" "}
                  {documentoDeOrigem.favorecidoNome ?? "documento sem emitente"} ·{" "}
                  <span className="mono">
                    {formatarBRL(documentoDeOrigem.valorCentavos ?? 0)}
                  </span>
                </div>
                <div className="mt-2">
                  <Botao
                    variante="ghost"
                    onClick={() => {
                      // Os dois juntos: o efeito só CARREGA, e desfazer é ato
                      // do usuário, não sincronização de estado.
                      setDocumentoDeOrigemId(null);
                      setDocumentoDeOrigem(null);
                    }}
                  >
                    Desfazer o vínculo antes de salvar
                  </Botao>
                </div>
              </Card>
            ) : null}

            <Card className="flex flex-col gap-3.5">
              {documentoDeOrigemId ? (
                documentoDeOrigem ? (
                  <FavorecidoHerdado
                    nota={documentoDeOrigem}
                    nome={nome}
                    documento={documento}
                    erroNome={erroDe("favorecidoNome")}
                    erroDocumento={erroDe("favorecidoDocumento")}
                  />
                ) : (
                  <Carregando rotulo="Carregando a nota" />
                )
              ) : (
                <>
                  <CampoTexto
                    rotulo="Favorecido"
                    valor={nome}
                    onChange={setNome}
                    placeholder="Quem recebeu o PIX"
                    erro={erroDe("favorecidoNome")}
                  />
                  <CampoTexto
                    rotulo="CNPJ / CPF do favorecido"
                    valor={documento}
                    onChange={setDocumento}
                    inputMode="numeric"
                    placeholder="00.000.000/0000-00"
                    erro={erroDe("favorecidoDocumento")}
                  />
                </>
              )}
              <CampoTexto
                rotulo="Valor"
                valor={valor}
                onChange={setValor}
                inputMode="decimal"
                placeholder="0,00"
                ajuda={ajudaValor}
                erro={erroDe("valorCentavos")}
              />
              <CampoTexto
                rotulo="Data do pagamento"
                tipo="date"
                valor={data}
                onChange={setData}
                erro={erroDe("dataPagamento")}
              />
              <CampoArquivo
                rotulo="Comprovante"
                ajuda="Anexe o comprovante do PIX — obrigatório."
                accept=".pdf,image/*"
                arquivo={comprovante}
                onChange={setComprovante}
                erro={erroDe("temComprovante")}
              />
            </Card>

            {documentoDeOrigem ? (
              <Banner cor="amb" role="status">
                Se o pagamento salvar e o vínculo falhar, a tela diz que o
                pagamento ficou <strong>sem vínculo</strong> e mostra como
                completar — nunca um sucesso mentiroso.
              </Banner>
            ) : null}

            <Banner cor="amb" role="status">
              Vai nascer como{" "}
              <strong>aguardando {rotulos.documento}</strong>.{" "}
              {tipoFavorecido === "pf" ? (
                <>
                  Prestador PF não emite nota: o que sustenta o custo é o recibo
                  assinado com nome, CPF e descrição do serviço — junto deste
                  comprovante.
                </>
              ) : tipoFavorecido === "pj" ? (
                <>
                  O custo só conta no IR com a nota hábil junto: sem ela, este
                  pagamento fica como pago sem nota.
                </>
              ) : (
                <>
                  Informe o CNPJ/CPF do favorecido: PJ deve NF, PF deve recibo
                  assinado (nome, CPF e descrição do serviço). O custo só conta
                  no IR com o documento junto.
                </>
              )}
            </Banner>
          </>
        ) : null}
      </Corpo>

      {registro.fase === "pronta" ? (
        <Rodape>
          <Passo>Interação 3 de 3 ↓</Passo>
          <Botao
            variante="primary"
            onClick={salvar}
            disabled={fase.nome === "salvando"}
          >
            {fase.nome === "salvando"
              ? "Salvando…"
              : documentoDeOrigem
                ? obraDivergente
                  ? "Salvar sem ligar à nota"
                  : "Salvar pagamento e ligar à nota"
                : `Salvar — aguardando ${rotulos.documento}`}
          </Botao>
          <BotaoLink href="/adicionar">Voltar</BotaoLink>
        </Rodape>
      ) : (
        <Rodape>
          <BotaoLink href="/adicionar">Voltar</BotaoLink>
        </Rodape>
      )}
    </>
  );
}

/**
 * Favorecido e CNPJ/CPF do pagamento que NASCE LIGADO a uma nota: herdados,
 * sem campo de edição.
 *
 * Adendo de 2026-08-18 do parecer
 * `docs/pareceres/2026-08-17-vinculo-pagamento-documento.md`, §1 e §4:
 *
 *   Fiscalmente, o par que sustenta custo é `documento hábil ↔ desembolso
 *   correspondente`. Quem recebe o dinheiro não é um terceiro grau de
 *   liberdade: é atributo do documento. [...] O produto não deve oferecer o
 *   campo.
 *
 * O campo editável não era só o caminho do bug (typo criando favorecido
 * duplicado, ou renomeando o antigo): é um campo que fiscalmente não existe.
 * O VALOR continua editável — é o único dos três que diverge legitimamente,
 * porque a nota se paga em parcelas.
 *
 * ⚠️ Impasse com saída, nunca bloqueio total (§4, item 4: "impasse sem saída
 * ensina o usuário a inventar dado no campo que sobrou"). São duas: corrigir
 * na nota, e o "Desfazer o vínculo antes de salvar" logo acima — sem vínculo,
 * o pagamento é avulso e os campos voltam a ser digitáveis.
 *
 * Os erros de validação aparecem AQUI: nota sem emitente identificado
 * reprovaria no "Salvar" com a mensagem sem lugar para aparecer, que é a
 * falha muda que este produto não aceita.
 */
function FavorecidoHerdado({
  nota,
  nome,
  documento,
  erroNome,
  erroDocumento,
}: {
  nota: Documento;
  nome: string;
  documento: string;
  erroNome?: string;
  erroDocumento?: string;
}) {
  const daNota = `da ${NOME_TIPO[nota.tipo]} de ${formatarBRL(nota.valorCentavos ?? 0)}`;
  return (
    // `group` com nome: dá ao bloco herdado uma identidade acessível — e é por
    // ela que o E2E distingue o que está AQUI do mesmo nome repetido no cartão
    // "Ligado a:" logo acima.
    <div
      role="group"
      aria-label="Favorecido da nota"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1">
        <Rotulo>Favorecido — {daNota}</Rotulo>
        <div className="text-[15px] font-semibold">
          {nome || "esta nota está sem emitente identificado"}
        </div>
        <ErroCampo mensagem={erroNome} />
      </div>
      <div className="flex flex-col gap-1">
        <Rotulo>CNPJ / CPF do favorecido — {daNota}</Rotulo>
        <div className="mono text-[15px]">
          {documento || "esta nota está sem CNPJ/CPF"}
        </div>
        <ErroCampo mensagem={erroDocumento} />
      </div>
      <p className="text-[12px] text-mut">
        Quem recebe o dinheiro é atributo da nota, não do pagamento. CNPJ/CPF
        errado não se edita: é outro favorecido — corrige-se o documento e
        refaz-se o vínculo.
      </p>
      <div>
        <BotaoLink href={`/documento/${nota.id}`}>Corrigir na nota</BotaoLink>
      </div>
    </div>
  );
}

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando rotulo="Carregando a obra" />}>
      <RegistrarPagamento />
    </Suspense>
  );
}
