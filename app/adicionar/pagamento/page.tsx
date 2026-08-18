"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { CampoArquivo, CampoTexto } from "@/app/_components/campos";
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
  classificarErro,
  criarPagamento,
  criarVinculos,
  garantirFavorecido,
  mensagemDeErro,
  subirParaAcervo,
} from "@/lib/data";
import { ehDocumentoHabil } from "@/lib/fiscal/vinculo";
import { soDigitos, tipoPorDocumento } from "@/lib/fiscal/identificacao";
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
import { formatarBRL, parseValorInput } from "@/lib/money";
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
    };

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

  useEffect(() => {
    if (!documentoDeOrigemId) return;
    let cancelado = false;
    void (async () => {
      try {
        const carregado = await carregarDocumento(documentoDeOrigemId);
        if (cancelado) return;
        setDocumentoDeOrigem(carregado);
        // O nome do emitente vem da nota porque é a mesma pessoa e poupa
        // digitação no canteiro. O VALOR não vem: default em campo fiscal é
        // proibido, e "pagou exatamente o valor da nota" é suposição — o caso
        // da parcela é o comum na obra.
        setNome((atual) => atual || (carregado.favorecidoNome ?? ""));
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
      if (documentoDeOrigem) {
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
        } catch {
          vinculoFalhou = true;
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
              a nota. Ele está registrado no acervo e conta como pago sem nota
              até você ligar os dois — abra o pagamento e use
              &quot;Ligar a uma nota&quot;.
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
          documentoDeOrigem
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
              <CampoTexto
                rotulo="Valor"
                valor={valor}
                onChange={setValor}
                inputMode="decimal"
                placeholder="0,00"
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
                ? "Salvar pagamento e ligar à nota"
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

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando rotulo="Carregando a obra" />}>
      <RegistrarPagamento />
    </Suspense>
  );
}
