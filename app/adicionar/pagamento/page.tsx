"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import {
  CampoArquivo,
  CampoTexto,
  Escolha,
  ErroCampo,
  Rotulo,
} from "@/app/_components/campos";
import { SugestaoQuitacao } from "@/app/_components/quitacao";
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
  Dica,
  EstadoErro,
  Linha,
  Passo,
  Rodape,
} from "@/app/_components/ui";
import {
  carregarDocumento,
  carregarPagamento,
  carregarPainel,
  classificarErro,
  criarCompromisso,
  criarPagamento,
  criarVinculos,
  garantirFavorecido,
  mensagemDeErro,
  subirParaAcervo,
} from "@/lib/data";
import {
  decidirRegistro,
  RECUSA_CARTAO,
  RECUSA_CARTAO_ONDE_REGISTRAR,
} from "@/lib/fiscal/compromisso";
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
  DATA_QUE_VALE_PARA_O_CUSTO,
  STATUS_PAGAMENTO_AVULSO,
  anoCalendario,
  rotulosPagoSemComprovante,
  rotulosPagoSemNota,
  validarPagamentoAvulso,
  type EntradaPagamento,
  type ErroCampoPagamento,
} from "@/lib/fiscal/pagamento";
import { formatarDataBR } from "@/lib/fiscal/obra";
import { hojeIso } from "@/lib/hoje";
import { centavosParaInput, formatarBRL, parseValorInput } from "@/lib/money";
import type {
  Documento,
  MeioPagamento,
  Pagamento,
  TipoFavorecido,
} from "@/lib/types";

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
      /**
       * O pagamento recém-gravado, para a SUGESTÃO DE QUITAÇÃO — que aparece
       * DEPOIS da gravação e nunca antes (critério 37).
       */
      pagamento: Pagamento | null;
    }
  /**
   * CONTAI-019, critério 6: data futura cria COMPROMISSO, não pagamento. Fase
   * própria porque a confirmação é outra — não há custo, não há ano, não há
   * "próximo passo: vincular a nota". Reaproveitar a tela do pagamento aqui
   * seria dizer ao Mateus que aconteceu a mesma coisa.
   */
  | {
      nome: "agendado";
      id: string;
      obraNome: string;
      dataPrevista: string;
      valorPrevistoCentavos: number;
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
  /**
   * ⚠️ O MEIO entra no formulário por causa dos critérios 25-27: sem ele o
   * `meio = cartao` não teria como chegar aqui, e a guarda que impede o custo
   * de cair no ano errado seria código inalcançável.
   */
  const [meio, setMeio] = useState<MeioPagamento>("pix");
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [erros, setErros] = useState<ErroCampoPagamento[]>([]);
  /**
   * Critério 17 do CONTAI-021 — **aviso, não rascunho**. Sair por "Corrigir na
   * nota" com o formulário pela metade perde o que foi digitado, e o app avisa
   * ANTES, com os dois caminhos nomeados. Persistir formulário fiscal pela
   * metade é escopo novo (o anexo já escolhido **não sobrevive à navegação em
   * hipótese nenhuma**) e devolve dias depois um formulário sem contexto — o
   * oposto de "campo vazio pergunta, campo preenchido afirma".
   */
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);
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
   * ⚠️ **A DATA É O CONTROLE** (diretriz de desenho 1) — e o cartão é a
   * exceção nomeada (critério 27, adendo §B). Toda a mudança de comportamento
   * desta tela sai desta única linha; não existe segmented control
   * "já paguei / vou pagar", que seria um toque a mais no caminho de 95%.
   */
  const destino = decidirRegistro({ meio, data }, hojeIso());
  const vaiAgendar = destino.tipo === "compromisso";
  const cartaoRecusado = destino.tipo === "recusado";

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
    setErroSalvar(null);
    if (!obra || cartaoRecusado) return;

    // ⚠️ AGENDAMENTO: a validação de pagamento NÃO se aplica. Ela recusa data
    // futura (e a recusa fica, literalmente — critério 2), que é exatamente o
    // caso aqui. Compromisso é outra entidade, com outras condições: nem
    // desembolso, nem comprovante.
    if (vaiAgendar) {
      const faltando = validarAgendamento();
      setErros(faltando);
      if (faltando.length > 0) return;
      await salvarAgendamento();
      return;
    }

    const encontrados = validarPagamentoAvulso(entrada, hojeIso());
    setErros(encontrados);
    if (encontrados.length > 0) return;

    setFase({ nome: "salvando" });
    try {
      if (tipoFavorecido === null) throw new Error("CNPJ/CPF inválido.");

      // ⚠️ SEM COMPROVANTE O BOTÃO GRAVA ASSIM MESMO (critério 46, ADENDO 2
      // §5): "o botão grava sempre; o que muda é o estado que nasce".
      // *Nunca recuse o registro de um fato consumado.* O pagamento nasce sem
      // `comprovante_path`, fora do custo confirmado, e vira a pendência
      // "pago sem comprovante" — com o peso do favorecido (critério 47).
      const comprovantePath = comprovante
        ? await subirParaAcervo(comprovante, "comprovante")
        : null;
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
        meio,
        // `data_compra` só existe para cartão, e cartão não chega aqui
        // (critério 25). PIX e boleto têm uma data só.
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

      // Recarregado do banco (e não montado a partir do formulário) porque é
      // ele que alimenta a SUGESTÃO DE QUITAÇÃO: o gatilho casa por
      // `favorecido_id`, que só existe depois do `garantirFavorecido`.
      // Falha aqui não estraga o sucesso — o pagamento está gravado.
      let pagamento: Pagamento | null = null;
      try {
        pagamento = await carregarPagamento(id);
      } catch {
        pagamento = null;
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
        pagamento,
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

  /**
   * O agendamento tem TRÊS campos obrigatórios e nenhum a mais: favorecido,
   * CNPJ/CPF e valor previsto. **Comprovante não entra** — "compromisso não
   * exige anexo" é a exceção nomeada do parecer §4, e é exceção por não
   * afirmar fato nenhum. Exigir anexo aqui "produziria o pior resultado
   * possível: atrito que faz ele não registrar, e a previsão volta para a
   * memória".
   */
  function validarAgendamento(): ErroCampoPagamento[] {
    const faltando: ErroCampoPagamento[] = [];
    if (nome.trim().length < 2) {
      faltando.push({
        campo: "favorecidoNome",
        mensagem: "Informe o nome do favorecido.",
      });
    }
    if (tipoPorDocumento(documento) === null) {
      faltando.push({
        campo: "favorecidoDocumento",
        mensagem: "CNPJ/CPF inválido — confira os dígitos.",
      });
    }
    if (entrada.valorCentavos === null || entrada.valorCentavos <= 0) {
      faltando.push({
        campo: "valorCentavos",
        mensagem: "Informe o valor previsto.",
      });
    }
    return faltando;
  }

  async function salvarAgendamento() {
    if (!obra) return;
    setFase({ nome: "salvando" });
    try {
      const tipo = tipoPorDocumento(documento);
      if (tipo === null) throw new Error("CNPJ/CPF inválido.");
      const favorecidoId = await garantirFavorecido({
        nome: nome.trim(),
        documento: soDigitos(documento),
        tipo,
      });
      const id = await criarCompromisso({
        obraId: obra.id,
        favorecidoId,
        valorPrevistoCentavos: entrada.valorCentavos as number,
        dataPrevista: data,
        // Boleto e PIX previsto são fiscalmente IDÊNTICOS: zero (Gate Fiscal
        // 7). A origem é campo probatório, nunca bifurcação de regra.
        origem: meio === "cartao" ? "cartao" : meio,
        documentoOrigemId: documentoDeOrigem?.id ?? null,
        dataCompra: null,
      });
      setFase({
        nome: "agendado",
        id,
        obraNome: obra.nome,
        dataPrevista: data,
        valorPrevistoCentavos: entrada.valorCentavos as number,
      });
    } catch (erro) {
      setFase({ nome: "formulario" });
      if (classificarErro(erro).tipo === "sem_sessao") {
        pedirReautenticacao();
        return;
      }
      setErroSalvar(mensagemDeErro(erro));
    }
  }

  /**
   * A confirmação do AGENDAMENTO é outra tela, e diz outra coisa: **zero**.
   * Nenhum número desta tela soma com custo nenhum (parecer §2).
   */
  if (fase.nome === "agendado") {
    return (
      <>
        <AppBar titulo="Agendado ✓" sub={fase.obraNome} />
        <Corpo>
          <Banner cor="amb" role="status">
            <strong>Agendado.</strong> Nada saiu da conta — este valor{" "}
            <strong>não entra no custo de aquisição</strong> e não aparece em
            total nenhum até o dinheiro sair.
          </Banner>
          <Card className="border-dashed border-amb">
            <Linha rotulo="Valor previsto">
              <span className="mono text-mut">
                ~ {formatarBRL(fase.valorPrevistoCentavos)}
              </span>
            </Linha>
            <Linha rotulo="Quando">
              <strong>para {formatarDataBR(fase.dataPrevista)}</strong>
            </Linha>
            <Linha rotulo={`Custo ${anoCalendario(fase.dataPrevista)}`}>
              <span className="mono">{formatarBRL(0)}</span>
            </Linha>
          </Card>
          <Dica>
            Quando o dinheiro sair, abra este agendamento e registre o
            pagamento — é a data de lá que decide o ano do custo.
          </Dica>
        </Corpo>
        <Rodape>
          <BotaoLink href={`/compromisso/${fase.id}`}>
            Ver o agendamento
          </BotaoLink>
          <BotaoLink href="/" variante="primary">
            Voltar ao início
          </BotaoLink>
        </Rodape>
      </>
    );
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
          // Item (f) do Gate 1b: "regime de caixa" sai desta tela (critério 7)
          // — é o NOME da regra, não a regra, e não ensina nada a um usuário
          // de uma pessoa só. A regra em linguagem de tela está no campo de
          // data, com o exemplo (§F.5).
          ligou
            ? "conta pelo ano em que este pagamento saiu"
            : `só conta depois de vincular ${salvos.documento}`
        }
        extra={
          fase.pagamento ? (
            <SugestaoQuitacao pagamento={fase.pagamento} />
          ) : undefined
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

  /**
   * Tela s1c do mock do CONTAI-021 — a confirmação de dois botões NOMEADOS.
   *
   * O texto dá a **saída barata**, não só o susto: o pagamento aponta para o
   * FAVORECIDO, não para o texto do nome dele. Corrigir antes ou depois grava
   * exatamente o mesmo dado — o que muda é só quanto ele redigita.
   */
  if (confirmandoSaida && documentoDeOrigem) {
    return (
      <>
        <AppBar
          titulo="Sair para corrigir a nota?"
          sub="você já preencheu parte deste pagamento"
        />
        <Corpo>
          <Banner cor="amb" role="alert">
            O que você digitou <strong>não vai ser guardado</strong>. Valor, data
            e meio voltam em branco. E o arquivo que você já escolheu{" "}
            <strong>não sobrevive a esta navegação</strong> — vai precisar
            anexar de novo, mesmo que a tela pareça lembrar dele.
          </Banner>
          <Card>
            <div className="font-semibold">O que se perde</div>
            <Linha rotulo="Valor">
              <span className="mono">{valor.trim() || "—"}</span>
            </Linha>
            <Linha rotulo="Data do pagamento">
              <span className="mono">{formatarDataBR(data)}</span>
            </Linha>
            <Linha rotulo="Meio">{meio}</Linha>
            <Linha rotulo="Comprovante">
              {comprovante ? `${comprovante.name} — não sobrevive` : "—"}
            </Linha>
          </Card>
          <Card>
            <div className="font-semibold">
              Você provavelmente não precisa sair agora
            </div>
            <Dica>
              O pagamento aponta para o <strong>favorecido</strong>, não para o
              texto do nome dele. Termine este pagamento e corrija o nome depois,
              pelo documento: o dado gravado é exatamente o mesmo. Corrigir antes
              ou corrigir depois grava a mesma coisa — o que muda é só quanto
              você redigita.
            </Dica>
          </Card>
        </Corpo>
        <Rodape>
          <Botao variante="primary" onClick={() => setConfirmandoSaida(false)}>
            Continuar o pagamento
          </Botao>
          <BotaoLink
            href={`/documento/${documentoDeOrigem.id}/corrigir/emitente?voltar=pagamento`}
          >
            Sair e corrigir a nota — perco o que digitei
          </BotaoLink>
        </Rodape>
      </>
    );
  }

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
            : vaiAgendar
              ? "Data no futuro — vai virar agendamento"
              : `hoje é ${formatarDataBR(hojeIso())}`
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

            {/* ⚠️ MEIO — e a guarda do cartão (critérios 25-27). */}
            <Card className="flex flex-col gap-3.5">
              <Escolha
                rotulo="Como foi pago"
                opcoes={[
                  { valor: "pix", texto: "PIX" },
                  { valor: "boleto", texto: "Boleto" },
                  { valor: "cartao", texto: "Cartão" },
                ]}
                valor={meio}
                onChange={setMeio}
              />
              {cartaoRecusado ? (
                // ⚠️ A recusa NUNCA é muda: diz por que e diz o que fazer no
                // lugar (critério 25). E ela vem ANTES do teste da data — uma
                // compra de ontem no cartão não pode virar pagamento por
                // caminho nenhum (critério 27).
                <Banner cor="red" role="alert">
                  <strong>{RECUSA_CARTAO}.</strong>{" "}
                  {RECUSA_CARTAO_ONDE_REGISTRAR}
                </Banner>
              ) : null}
            </Card>

            <Card className="flex flex-col gap-3.5">
              {documentoDeOrigemId ? (
                documentoDeOrigem ? (
                  <FavorecidoHerdado
                    nota={documentoDeOrigem}
                    nome={nome}
                    documento={documento}
                    erroNome={erroDe("favorecidoNome")}
                    erroDocumento={erroDe("favorecidoDocumento")}
                    /**
                     * ⚠️ O que conta como "digitado" é só o que SAIU DO DEDO
                     * DELE, e a distinção não é preciosismo:
                     * - data e meio nascem preenchidos (hoje, PIX);
                     * - o VALOR nasce preenchido pelo app com o saldo da nota
                     *   (`sugestaoValor`), num pagamento que nasce ligado — que
                     *   é exatamente o caminho por onde este link é alcançado.
                     * Contar qualquer um dos três faria o aviso aparecer
                     * SEMPRE, e aviso que aparece sempre é o aviso que se
                     * aprende a dispensar. Ele só aparece quando há de fato
                     * algo a perder: valor DIFERENTE do sugerido, ou um
                     * comprovante já escolhido — que é o único que não
                     * sobrevive à navegação em hipótese nenhuma.
                     */
                    temAlgoDigitado={
                      (valor.trim() !== "" && valor !== sugestaoValor?.texto) ||
                      comprovante !== null
                    }
                    onSairParaCorrigir={() => setConfirmandoSaida(true)}
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
              {/* MUDANÇA 1 DAS TRÊS: o aviso vem COLADO no campo de data, e
                  não num banner no topo — quem digitou a data está olhando
                  aqui. */}
              <div className="flex flex-col gap-1.5">
                <CampoTexto
                  rotulo={vaiAgendar ? "Data prevista" : "Data do pagamento"}
                  tipo="date"
                  valor={data}
                  onChange={setData}
                  ajuda={vaiAgendar ? undefined : DATA_QUE_VALE_PARA_O_CUSTO}
                  erro={erroDe("dataPagamento")}
                />
                {vaiAgendar ? (
                  <Banner cor="amb" role="status">
                    <strong data-aviso="data-futura">
                      {formatarDataBR(data)} ainda não aconteceu.
                    </strong>{" "}
                    Isto vai ser gravado como <strong>agendamento</strong>: não
                    entra no custo de aquisição e não aparece em nenhum total
                    até o dinheiro sair.
                  </Banner>
                ) : null}
              </div>

              {/* Critério 11: o campo se chama VALOR PREVISTO quando é
                  previsão. O nome é parte da proteção — "valor" convida à
                  soma mista. */}
              <CampoTexto
                rotulo={vaiAgendar ? "Valor previsto" : "Valor"}
                valor={valor}
                onChange={setValor}
                inputMode="decimal"
                placeholder="0,00"
                ajuda={ajudaValor}
                erro={erroDe("valorCentavos")}
              />

              {/* MUDANÇA 2 DAS TRÊS: no agendamento o comprovante DESAPARECE.
                  "Compromisso não exige anexo" (parecer §4) — é a única
                  entidade do app que nasce sem ele, e é exceção por não
                  afirmar fato nenhum. */}
              {vaiAgendar ? (
                <Dica>
                  <strong>Aqui o anexo não é exigido.</strong> Agendamento é a
                  única coisa no app que nasce sem anexo obrigatório — ele não
                  compõe custo nenhum, logo não há o que sustentar. Anexar o
                  boleto é útil e recomendado, jamais bloqueante.
                </Dica>
              ) : (
                <CampoArquivo
                  rotulo="Comprovante"
                  ajuda="Anexe o comprovante do PIX. O botão salva mesmo sem ele — o que muda é o estado que nasce."
                  accept=".pdf,image/*"
                  arquivo={comprovante}
                  onChange={setComprovante}
                />
              )}
            </Card>

            {/* ⚠️ CRITÉRIO 46: o botão grava sempre; o que muda é o ESTADO.
                A consequência é dita ANTES, e muda de peso com o favorecido
                (critério 47, ADENDO 2 §5 — para PF o comprovante é
                CONSTITUTIVO, não acessório). */}
            {!vaiAgendar && comprovante === null ? (
              <Banner
                cor={rotulosPagoSemComprovante(tipoFavorecido).gravidade}
                role="status"
              >
                <strong>Vai salvar assim mesmo.</strong> Fica como{" "}
                <strong>
                  {rotulosPagoSemComprovante(tipoFavorecido).consequencia}
                </strong>
                .
              </Banner>
            ) : null}

            {documentoDeOrigem ? (
              <Banner cor="amb" role="status">
                Se o pagamento salvar e o vínculo falhar, a tela diz que o
                pagamento ficou <strong>sem vínculo</strong> e mostra como
                completar — nunca um sucesso mentiroso.
              </Banner>
            ) : null}

            {vaiAgendar ? null : (
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
            )}
          </>
        ) : null}
      </Corpo>

      {registro.fase === "pronta" ? (
        <Rodape>
          <Passo>{vaiAgendar ? "Nada sai da conta hoje ↓" : "Passo 3 de 3 ↓"}</Passo>
          {/* MUDANÇA 3 DAS TRÊS: o botão troca de VERBO e de PESO. "Salvar
              pagamento" (primary) vira "Agendar" (ghost) — o agendamento não
              é o ato de peso da tela, e o verbo diferente é a última chance de
              perceber que a data está no futuro. */}
          <Botao
            variante={vaiAgendar ? "ghost" : "primary"}
            onClick={salvar}
            disabled={fase.nome === "salvando" || cartaoRecusado}
          >
            {fase.nome === "salvando"
              ? "Salvando…"
              : cartaoRecusado
                ? "Cartão ainda não tem fluxo neste app"
                : vaiAgendar
                  ? "Agendar — não entra no custo"
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
  temAlgoDigitado,
  onSairParaCorrigir,
}: {
  nota: Documento;
  nome: string;
  documento: string;
  erroNome?: string;
  erroDocumento?: string;
  /** Critério 17: com o formulário pela metade, o link avisa antes de sair. */
  temAlgoDigitado: boolean;
  onSairParaCorrigir: () => void;
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
        {/**
         * Critério 2 do CONTAI-021 — o link sai da CAIXA DO FAVORECIDO, então o
         * destino natural é a correção do NOME DO EMITENTE, não uma tela
         * genérica. De lá, quem descobre que o erro é outro tem saída para as
         * outras duas ações e para o texto do CNPJ.
         *
         * ⚠️ Até 19/08 ele levava a `/documento/[id]`, onde não existia
         * correção nenhuma: "o usuário clica em Corrigir na nota e chega numa
         * tela que não corrige" — a disciplina do critério 19 do CONTAI-018
         * (nenhuma tela promete comportamento que não existe) violada por um
         * botão.
         */}
        {temAlgoDigitado ? (
          <Botao variante="ghost" onClick={onSairParaCorrigir}>
            Corrigir na nota
          </Botao>
        ) : (
          <BotaoLink
            href={`/documento/${nota.id}/corrigir/emitente?voltar=pagamento`}
          >
            Corrigir na nota
          </BotaoLink>
        )}
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
