"use client";

/**
 * CONFIRMAR O PAGAMENTO de um agendamento — CONTAI-019, critérios 12 a 17,
 * 28 a 30, 44 e 45.
 *
 * ⚠️ **O CAMPO DE DATA NASCE VAZIO** (critério 17). O mock v2 ainda o
 * pré-preenche com a data prevista, e **isso é o defeito, não o requisito** —
 * o próprio `designer` chamou de "o defeito mais caro deste desenho", porque o
 * ticket original apontava como mitigação do pre-mortem justamente o critério
 * que causava o risco.
 *
 * A razão é a decisão nº 1 do fechamento de 18/08, e ela distingue os dois
 * campos: o VALOR vem pré-preenchido porque **o documento afirma o valor** — é
 * fato documentado. **A data prevista não é afirmada por documento nenhum**: é
 * palpite, e só o extrato sabe quando o dinheiro saiu. Preencher afirma fato
 * inexistente.
 *
 * A opção "manter o previsto exigindo um toque de confirmação" foi descartada
 * como **pior que pré-preencher**: é máquina de habituação — ele confirma o
 * default com a mesma mão, agora com a sensação de ter conferido.
 *
 * A linha que separa o permitido do proibido: **default de navegação sim,
 * default de valor não**. O date picker pode abrir no mês corrente; nada é
 * gravado até ele escolher o dia. **Não existe atalho "hoje"** nesta tela.
 *
 * ⚠️ **Nenhum caminho de código grava a data prevista** — ela aparece só como
 * referência read-only, cinza e com `~`.
 *
 * ⚠️ **CONTAI-045 — a migração para o shell é DE CASCA, e só.** Esta é a tela
 * que o `CONTAI-034` consertou por default fiscal indevido (`cValor` nascia com
 * o saldo previsto — **D65**), e o critério 3 do ticket de migração é explícito:
 * nenhum default volta em campo fiscal. `cData`, `cValor`, `cEncargos` e
 * `cSaldoData` continuam nascendo vazios, com o mesmo `data-campo` que a trava
 * de `e2e/campos-fiscais.spec.ts` lê — a mudança de pasta não move a âncora.
 * É formulário com UMA ação de página, logo ele **tem** `RodapeDeAcao`
 * (decisão 4 do `detalhe-no-shell-v1`).
 */

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { CampoArquivo, CampoTexto } from "@/app/_components/campos";
import {
  CabecalhoDaTela,
  ColunaDeDetalhe,
  RodapeDeAcao,
} from "@/app/_components/detalhe";
import {
  Banner,
  Botao,
  BotaoLink,
  BotaoSalvar,
  Card,
  Carregando,
  Dica,
  EstadoErro,
  Linha,
  Passo,
} from "@/app/_components/ui";
import {
  carregarCompromisso,
  carregarFavorecido,
  carregarPainel,
  classificarErro,
  criarPagamento,
  criarVinculos,
  mensagemDeErroDeGravacao,
  quitarCompromisso,
  registrarDiferenca,
  subirParaAcervo,
  type ErroDeTela,
} from "@/lib/data";
import {
  documentosResolvidosNaConfirmacao,
  identificarDocumentoPreLigado,
  perguntaConfirmarPreVinculos,
  PRE_VINCULO_CONFIRMAR,
  PRE_VINCULO_REVISAR,
  preposicaoDeTempo,
  saldoDoCompromisso,
} from "@/lib/fiscal/compromisso";
import { ehDocumentoHabil } from "@/lib/fiscal/vinculo";
import { formatarDataBR } from "@/lib/fiscal/obra";
import {
  DATA_QUE_VALE_PARA_O_CUSTO,
  ehDataValida,
  rotulosPagoSemComprovante,
  STATUS_PAGAMENTO_AVULSO,
  textoDiferencaSemExplicacao,
} from "@/lib/fiscal/pagamento";
import { hojeIso } from "@/lib/hoje";
import { formatarBRL, parseValorInput } from "@/lib/money";
import type {
  Compromisso,
  Documento,
  Pagamento,
  TipoFavorecido,
} from "@/lib/types";

/**
 * ⚠️ **Sem default e sem pré-seleção** (critério 13, adendo §D). `null` é o
 * estado inicial e o botão de gravar fica desabilitado enquanto ele durar:
 * "nenhum dos dois erros é mais barato, então não há default seguro para onde
 * cair — assumir desconto fecha um compromisso ainda devido e MATA O ALERTA;
 * assumir parcial deixa um saldo fantasma que trava o relatório anual".
 */
type EscolhaMenor = "quita" | "falta" | null;

export default function ConfirmarPagamento() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const hoje = hojeIso();

  const [compromisso, setCompromisso] = useState<Compromisso | null>(null);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  /**
   * **CONTAI-080** — as notas da obra, carregadas junto com o resto: é sobre
   * elas que a UNIÃO deduplicada do critério 10 resolve. Ler no momento da
   * CONFIRMAÇÃO, e não no da declaração, é o que o ADENDO 7 §K.3 exige.
   */
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  /**
   * **CONTAI-080, ramo N≥2** — o pagamento JÁ está salvo quando isto vira
   * `true`; o que falta é só a decisão sobre os vínculos (ADENDO 6 §J.3).
   */
  const [revisarPreVinculos, setRevisarPreVinculos] = useState(false);
  const [tipoFavorecido, setTipoFavorecido] = useState<TipoFavorecido | null>(null);
  const [erroCarregar, setErroCarregar] = useState<ErroDeTela | null>(null);

  /** ⚠️ VAZIA. Ver o cabeçalho do arquivo. */
  const [data, setData] = useState("");
  const [valor, setValor] = useState("");
  const [encargos, setEncargos] = useState("");
  const [escolhaMenor, setEscolhaMenor] = useState<EscolhaMenor>(null);
  const [dataSaldo, setDataSaldo] = useState("");
  const [saldoSemData, setSaldoSemData] = useState(false);
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  /**
   * ⚠️ **O RETRY RETOMA, NUNCA RECOMEÇA** (Gate 2 do CONTAI-019, B4).
   *
   * A gravação são quatro passos em quatro chamadas — não existe transação
   * multi-statement pelo PostgREST. Antes disto, uma falha em qualquer um
   * deles devolvia ao mesmo botão, e o toque seguinte **re-executava
   * `criarPagamento`**: nascia um SEGUNDO pagamento real e o primeiro ficava
   * órfão, como pendência vermelha, **para sempre** — o app não apaga nada
   * (acervo append-only, CONTAI-009) e a correção do CONTAI-021 não existe.
   * Com favorecido PF o dano sai do app: o desembolso duplicado entra na ficha
   * **Pagamentos Efetuados**, CPF por CPF.
   *
   * Cada passo bem-sucedido fica registrado aqui, e o retry pula o que já
   * passou.
   */
  const [progresso, setProgresso] = useState<{
    comprovanteEnviado: boolean;
    comprovantePath: string | null;
    pagamentoId: string | null;
    diferencaGravada: boolean;
    /**
     * **CONTAI-080, PASSO 5** — o vínculo do pré-vínculo resolvido. Rastreado
     * como os outros quatro: a gravação é `upsert` com `ignoreDuplicates`, logo
     * idempotente por construção, mas o `feito` evita a ida de rede à toa no
     * retry e mantém a leitura do progresso honesta.
     */
    vinculosCriados: boolean;
  }>({
    comprovanteEnviado: false,
    comprovantePath: null,
    pagamentoId: null,
    diferencaGravada: false,
    vinculosCriados: false,
  });

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const c = await carregarCompromisso(id);
        const painel = await carregarPainel(c.obraId);
        if (cancelado) return;
        setCompromisso(c);
        setPagamentos(painel.pagamentos.filter((p) => c.pagamentoIds.includes(p.id)));
        setDocumentos(painel.documentos);
        // ⚠️ O tipo vem da TABELA `favorecido`, não de outros pagamentos dele.
        // Derivar de pagamentos errava exatamente no PRIMEIRO pagamento a um
        // PJ: caía em `null` e a tela saía VERMELHA pedindo um CNPJ que já
        // estava cadastrado. O §G.3 reserva o vermelho ao favorecido **não
        // identificado** — este está identificado.
        setTipoFavorecido(
          c.favorecidoId === null
            ? null
            : ((await carregarFavorecido(c.favorecidoId))?.tipo ?? null),
        );
        // ⚠️ **NADA DE PRÉ-PREENCHER O VALOR** (D65, Gate 2 do CONTAI-034).
        // Até 2026-09-21 esta linha carregava o campo com o saldo do
        // agendamento, e era a D44 de novo com outra roupa: `cValor` é o que
        // foi PAGO, e é ele que vira custo de aquisição no regime de caixa —
        // o previsto nunca é o número que conta. O campo gêmeo do registro
        // direto (`fValor`, /adicionar/pagamento) nasce vazio pelo mesmo
        // motivo; ter um dos dois pré-preenchido era o app afirmando um
        // desembolso que ninguém conferiu.
      } catch (e) {
        if (!cancelado) setErroCarregar(classificarErro(e));
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [id]);

  const pagoCentavos = parseValorInput(valor);
  const encargosCentavos = encargos.trim() === "" ? 0 : parseValorInput(encargos);
  const previstoCentavos = compromisso
    ? saldoDoCompromisso(compromisso, pagamentos) ||
      compromisso.valorPrevistoCentavos
    : 0;

  const diferenca = pagoCentavos === null ? 0 : pagoCentavos - previstoCentavos;
  const pagouMais = diferenca > 0;
  const pagouMenos = diferenca < 0;

  /**
   * O que sobra depois dos encargos identificados. Fica FORA do custo enquanto
   * não houver resposta — direção segura, subestima (§F.2).
   */
  const naoExplicadoCentavos = useMemo(() => {
    if (!pagouMais) return 0;
    return Math.max(0, diferenca - (encargosCentavos ?? 0));
  }, [pagouMais, diferenca, encargosCentavos]);

  const dataNoFuturo = data !== "" && ehDataValida(data) && data > hoje;

  /**
   * ⚠️ Botão DESABILITADO enquanto a data estiver vazia (critério 17), e
   * enquanto a escolha do valor menor não for feita (critério 13).
   */
  const podeSalvar =
    data !== "" &&
    ehDataValida(data) &&
    !dataNoFuturo &&
    pagoCentavos !== null &&
    pagoCentavos > 0 &&
    (!pagouMais || encargosCentavos !== null) &&
    (!pagouMenos || escolhaMenor !== null) &&
    (!pagouMenos || escolhaMenor !== "falta" || saldoSemData || dataSaldo !== "");

  async function salvar() {
    if (!compromisso || !podeSalvar || pagoCentavos === null) return;
    setSalvando(true);
    setErro(null);

    // Cópia local porque `setProgresso` é assíncrono: os passos seguintes
    // deste mesmo `salvar` precisam enxergar o que o anterior acabou de fazer.
    let feito = progresso;
    const avancar = (parcial: Partial<typeof progresso>) => {
      feito = { ...feito, ...parcial };
      setProgresso(feito);
    };

    try {
      // PASSO 1 · o comprovante NÃO bloqueia (critério 16): *nunca recuse o
      // registro de um fato consumado.* Sem ele o pagamento grava, não entra
      // no custo confirmado e vira a pendência "pago sem comprovante".
      if (!feito.comprovanteEnviado) {
        avancar({
          comprovanteEnviado: true,
          comprovantePath: comprovante
            ? await subirParaAcervo(comprovante, "comprovante")
            : null,
        });
      }

      // PASSO 2 · confirmar CRIA UM PAGAMENTO (critério 12) — não converte o
      // agendamento. Dois registros distintos com vínculo (parecer §3).
      //
      // ⚠️ A guarda `=== null` é o coração do B4: este é o passo que, repetido,
      // duplica dinheiro num acervo que não apaga.
      if (feito.pagamentoId === null) {
        avancar({
          pagamentoId: await criarPagamento({
            obra_id: compromisso.obraId,
            favorecido_id: compromisso.favorecidoId,
            valorCentavos: pagoCentavos,
            // ⚠️ A DATA QUE VAI PARA O BANCO É A DIGITADA. A prevista é
            // descartada na gravação — não há caminho de código que a grave.
            data_pagamento: data,
            // `origem` e `meio` são enums distintos com os mesmos três
            // valores, e este ramo é no-op HOJE: `origem = 'cartao'` não é
            // alcançável, porque a compra no cartão é recusada na entrada
            // (critérios 25-27). Quando o `CONTAI-022` abrir o fluxo da
            // fatura, é aqui que `data_compra` deixa de ser `null` — a linha
            // fica como marcação do ponto, não como conversão.
            meio: compromisso.origem === "cartao" ? "cartao" : compromisso.origem,
            data_compra: null,
            comprovante_path: feito.comprovantePath,
            status: STATUS_PAGAMENTO_AVULSO,
          }),
        });
      }

      // PASSO 3 · a composição do desembolso, quando existe. Gravada UMA vez;
      // só a resolução muda depois (critério 32). `pagamento_diferenca` tem o
      // `pagamento_id` como PK, então repetir aqui daria 23505 — o `feito`
      // evita transformar isso em erro de tela.
      if (
        !feito.diferencaGravada &&
        ((encargosCentavos ?? 0) > 0 || naoExplicadoCentavos > 0)
      ) {
        await registrarDiferenca({
          pagamentoId: feito.pagamentoId!,
          encargosCentavos: encargosCentavos ?? 0,
          naoExplicadoCentavos,
        });
        avancar({ diferencaGravada: true });
      }

      // ══ O N, CONTADO ANTES DO PASSO 4 — correção do D1 do Gate 2 ═══════════
      //
      // Fonte: ADENDO 7 §K.2 de
      // `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`, `[Certain]`.
      // O N é a UNIÃO deduplicada (pré-vínculos ∪ nota de origem), por UMA função
      // pura só.
      //
      // ⚠️ **A ORDEM É O CONSERTO.** Antes, isto era calculado DEPOIS do PASSO 4 —
      // e o PASSO 4 propagava a nota de origem incondicionalmente pela RPC do
      // CONTAI-065. Num conjunto N≥2 (origem + outra nota), a origem já estava em
      // `pagamento_documento` quando o bloco de revisão aparecia: **parte do
      // conjunto convertia sozinha**, e a revalidação do §J.3 cobria só o resto.
      // Contar antes e passar `propagarOrigem` é o que faz o fluxo N≥2 ser 100%
      // revalidado, como o parecer exige.
      const resolvidos = documentosResolvidosNaConfirmacao(compromisso, documentos);

      // PASSO 4 · ⚠️ `quitaIntegralmente` é DECISÃO HUMANA, nunca cálculo.
      // Pagou igual ou mais: quita. Pagou menos: é o que ele escolheu, sem
      // default. É idempotente por construção — o vínculo é upsert com
      // `ignoreDuplicates` e o `update` da situação é o mesmo valor.
      await quitarCompromisso({
        compromisso,
        pagamento: { id: feito.pagamentoId!, obraId: compromisso.obraId },
        quitaIntegralmente: !pagouMenos || escolhaMenor === "quita",
        // N=0 (nada a propagar) e N=1 (propaga sozinho, CONTAI-065 intacto) →
        // `true`. N≥2 → `false`: a origem espera o clique, junto com as outras.
        propagarOrigem: resolvidos.length < 2,
        ...(pagouMenos && escolhaMenor === "falta"
          ? { novaDataPrevista: saldoSemData ? null : dataSaldo }
          : {}),
      });

      // ══ PASSO 5 · CONTAI-080 — a CONVERSÃO do pré-vínculo, bifurcada por N ══

      // **N≥2 → confirmação explícita, sempre** (§J.3, mantido integralmente
      // pelo §K.4): *"existe, aí sim, uma decisão de rateio que só o Mateus pode
      // fazer"*. O pagamento já está salvo — o que falta é a decisão sobre os
      // vínculos, e nenhuma das duas saídas recusa ou silencia o pagamento.
      if (resolvidos.length >= 2) {
        setSalvando(false);
        setRevisarPreVinculos(true);
        return;
      }

      // **N=1 → automático, sem clique adicional** (§K.2), no MESMO padrão do
      // CONTAI-065. §K.1 derruba as duas razões que o §J.3 dava para exigir o
      // toque aqui: *"se a divergência de valor não impede a propagação
      // silenciosa de 1 documento hoje, ela não pode virar motivo para exigir
      // clique quando a mesma situação nasce de um pré-vínculo"*, e o precedente
      // da sugestão heurística (§C.d) *"compara a coisa errada"*.
      //
      // ⚠️ Quando esse único documento É a nota de origem, o PASSO 4 já criou a
      // linha pela RPC (`propagarOrigem` foi `true`, porque N=1) — e aqui a
      // duplicata é IGNORADA (`upsert` com `ignoreDuplicates` dentro de
      // `criarVinculos`). Os dois caminhos convergem na mesma linha de
      // `pagamento_documento`, sem RPC nova e sem 23505. **N=0 não passa por
      // aqui**: fluxo idêntico ao de antes deste ticket.
      if (resolvidos.length === 1 && !feito.vinculosCriados) {
        await criarVinculos(
          resolvidos.map((d) => ({
            pagamentoId: feito.pagamentoId!,
            documentoId: d.id,
            obraDoPagamentoId: compromisso.obraId,
            obraDoDocumentoId: d.obraId,
            documentoHabil: ehDocumentoHabil(d),
          })),
        );
        avancar({ vinculosCriados: true });
      }

      router.push(`/pagamento/${feito.pagamentoId!}`);
    } catch (e) {
      setErro(mensagemDeErroDeGravacao(e, "na lista de pagamentos desta obra"));
      setSalvando(false);
    }
  }

  /**
   * O "Sim, confirmar os vínculos" do bloco N≥2 — grava TODOS os resolvidos de
   * uma vez (§J.3: a revalidação cobre o conjunto, não par por par).
   *
   * Erro aqui **não navega e não desfaz nada**: o pagamento continua salvo e os
   * pré-vínculos continuam gravados, então repetir o clique é seguro — é a mesma
   * garantia de retry do B4, aplicada a um passo que não cria dinheiro.
   */
  async function confirmarPreVinculos(resolvidos: readonly Documento[]) {
    if (!compromisso || progresso.pagamentoId === null) return;
    setSalvando(true);
    setErro(null);
    try {
      await criarVinculos(
        resolvidos.map((d) => ({
          pagamentoId: progresso.pagamentoId!,
          documentoId: d.id,
          obraDoPagamentoId: compromisso.obraId,
          obraDoDocumentoId: d.obraId,
          documentoHabil: ehDocumentoHabil(d),
        })),
      );
      setProgresso((p) => ({ ...p, vinculosCriados: true }));
      router.push(`/pagamento/${progresso.pagamentoId}`);
    } catch (e) {
      setErro(
        mensagemDeErroDeGravacao(e, "no detalhe do pagamento, se as notas já aparecem ligadas"),
      );
      setSalvando(false);
    }
  }

  if (!compromisso) {
    return (
      <ColunaDeDetalhe>
          <CabecalhoDaTela titulo="Registrar o pagamento" />
          {erroCarregar ? (
            <EstadoErro erro={erroCarregar} />
          ) : (
            <Carregando rotulo="Carregando o agendamento" />
          )}
      </ColunaDeDetalhe>
    );
  }

  const rotulosComprovante = rotulosPagoSemComprovante(tipoFavorecido);

  /**
   * **CONTAI-080, ramo N≥2 — a revalidação do §J.3, em tela cheia.**
   *
   * Substitui a `ColunaDeDetalhe` inteira (mesmo padrão dos outros estados
   * terminais desta página): o formulário já cumpriu seu papel, o pagamento está
   * salvo, e a única decisão que resta é a dos vínculos.
   *
   * ⚠️ **NENHUMA das duas saídas recusa ou silencia o pagamento** — ele já está
   * no banco, e é isso que o texto diz antes dos botões. *"Nunca recuse o
   * registro de um fato consumado"* (§4 do parecer).
   *
   * ⚠️ **Nada de rateio automático** (§J.3, recusado pelo `contador`): os dois
   * botões gravam vínculo, nunca dividem valor. Quem reparte é o `min()` por
   * conjunto conexo de `alocarCusto`, depois, como em qualquer vínculo.
   */
  if (revisarPreVinculos) {
    const resolvidos = documentosResolvidosNaConfirmacao(compromisso, documentos);
    return (
      <>
        <CabecalhoDaTela
          titulo="Confirmar os vínculos"
          sub={`${compromisso.favorecidoNome ?? "favorecido"} · pagamento já salvo`}
        />
        <ColunaDeDetalhe>
          {erro ? (
            <Banner cor="red" role="alert">
              {erro}{" "}
              <strong>
                O pagamento já está salvo — tocar de novo NÃO grava um segundo.
              </strong>{" "}
              Falta só ligar as notas, e é isso que o botão faz agora.
            </Banner>
          ) : null}

          <Banner cor="grn" role="status">
            <strong>O pagamento está salvo.</strong> O que falta decidir é só a
            quais notas ele se liga — nenhuma das duas saídas abaixo desfaz o
            pagamento.
          </Banner>

          <Card className="border-ink" data-pre-vinculo="revisar">
            {/* Texto LITERAL do ADENDO 6 §J.3, montado por
                `perguntaConfirmarPreVinculos` — a tela não redige nem reordena. */}
            <p className="text-[14.5px] font-semibold">
              {perguntaConfirmarPreVinculos(resolvidos)}
            </p>
            {resolvidos.map((d) => (
              <Linha key={d.id} rotulo={identificarDocumentoPreLigado(d)}>
                <span className="text-mut">
                  {d.favorecidoNome ?? "emitente não informado"}
                </span>
              </Linha>
            ))}
            <div className="mt-3 flex flex-col gap-2">
              <BotaoSalvar
                ocupado={salvando}
                variante="primary"
                onClick={() => void confirmarPreVinculos(resolvidos)}
                disabled={salvando}
              >
                {PRE_VINCULO_CONFIRMAR}
              </BotaoSalvar>
              {/* Sem query param: a tela de destino deriva do estado GRAVADO o
                  que pré-marcar (critério 12/13). Nada foi apagado — só não foi
                  confirmado ainda. */}
              <BotaoLink href={`/pagamento/${progresso.pagamentoId}/ligar`}>
                {PRE_VINCULO_REVISAR}
              </BotaoLink>
            </div>
            <Dica>
              Você pode revisar: o valor pago pode não bater com o que estava
              previsto, e a nota certa pode ser outra. <strong>Nada é
              rateado automaticamente</strong> — quem divide é a regra do mínimo,
              depois de o vínculo existir.
            </Dica>
          </Card>
        </ColunaDeDetalhe>
      </>
    );
  }

  return (
    <>
      <CabecalhoDaTela
        titulo="Registrar o pagamento"
        sub={`${compromisso.favorecidoNome ?? "favorecido"} · ${preposicaoDeTempo(compromisso, hoje)}`}
      />
      <ColunaDeDetalhe>
        {erro ? (
          <Banner cor="red" role="alert">
            {erro}
            {progresso.pagamentoId !== null ? (
              <>
                {" "}
                <strong>
                  O pagamento já está salvo — tocar de novo NÃO grava um
                  segundo.
                </strong>{" "}
                Falta só ligá-lo a este agendamento, e é isso que o botão faz
                agora.
              </>
            ) : null}
          </Banner>
        ) : null}

        {/* ⚠️ O PREVISTO SÓ COMO REFERÊNCIA — read-only, cinza e com `~`. Ele
            nunca é o número que conta (critério 17). */}
        <Card className="border-dashed border-amb">
          <Linha rotulo="Valor previsto">
            <span className="mono text-mut" data-marca="valor-previsto">
              ~ {formatarBRL(previstoCentavos)}
            </span>
          </Linha>
          <Linha rotulo="Era para">
            <span className="text-mut">
              {compromisso.dataPrevista
                ? formatarDataBR(compromisso.dataPrevista)
                : "sem data definida"}
            </span>
          </Linha>
        </Card>

        <Card className="flex flex-col gap-3.5">
          {/* CAMPO 1 DOS DOIS OBRIGATÓRIOS (critério 45). NASCE VAZIO. */}
          <CampoTexto
            campo="cData"
            rotulo="Data em que o dinheiro saiu"
            tipo="date"
            valor={data}
            onChange={setData}
            // ⚠️ Congela depois que o pagamento entrou no banco: o retry só
            // completa o que falta, e um campo editável aqui ofereceria uma
            // correção que este botão não faz (o acervo não apaga).
            desabilitado={progresso.pagamentoId !== null}
            ajuda={DATA_QUE_VALE_PARA_O_CUSTO}
            erro={
              dataNoFuturo
                ? "Data no futuro — um pagamento só existe com desembolso ocorrido. Troque para o dia em que o dinheiro realmente saiu."
                : undefined
            }
          />

          {/* CAMPO 2 DOS DOIS. NASCE VAZIO, como a data — é o valor PAGO que
              vira custo, e o previsto não o antecipa (D65). */}
          <CampoTexto
            campo="cValor"
            rotulo="Valor efetivamente pago"
            valor={valor}
            onChange={setValor}
            inputMode="decimal"
            placeholder="0,00"
            desabilitado={progresso.pagamentoId !== null}
          />

          {/* ⚠️ A densidade cresce com a complicação fiscal, NÃO antes dela
              (critério 45): com valor igual ao previsto, esta tela tem dois
              campos e um botão, e nada mais aparece. */}
          {pagouMais ? (
            <div className="flex flex-col gap-2">
              {/* ⚠️ Este banner era a PORTA DE ENTRADA do erro do Gate 2: ele
                  perguntava só "quanto foi juros?", e o que sobrasse virava
                  "sem explicação" — fazendo a PREVISÃO virar o teto do custo
                  quando a previsão é que estava baixa. A pergunta agora tem as
                  duas saídas, e a segunda é dita aqui, antes do campo. */}
              <Banner cor="amb" role="status">
                <strong>
                  Você pagou {formatarBRL(diferenca)} a mais que o previsto.
                </strong>{" "}
                Quanto disso foi juros e multa por atraso? Juros e multa de mora{" "}
                <strong>não compõem custo de aquisição</strong>. Se não houve
                atraso, deixe em zero:{" "}
                <strong>a previsão estar errada é resposta legítima</strong>, e
                você a registra no detalhe do pagamento — o valor pago entra
                inteiro no custo, e quem limita é a nota.
              </Banner>
              <CampoTexto
                campo="cEncargos"
                rotulo="Juros e multa por atraso"
                valor={encargos}
                onChange={setEncargos}
                inputMode="decimal"
                placeholder="0,00"
              />
              {naoExplicadoCentavos > 0 ? (
                <Banner cor="red" role="status">
                  {/* Texto LITERAL do §F.4, com o valor interpolado. */}
                  {textoDiferencaSemExplicacao(naoExplicadoCentavos)}
                </Banner>
              ) : null}
            </div>
          ) : null}

          {pagouMenos ? (
            <div className="flex flex-col gap-2">
              <Banner cor="amb" role="status">
                <strong>
                  Você pagou {formatarBRL(-diferenca)} a menos que o previsto.
                </strong>{" "}
                O app não tem como saber o que aconteceu. Você é quem diz:
              </Banner>
              {/* ⚠️ DOIS BOTÕES DE MESMO PESO, NENHUM PRÉ-SELECIONADO. Rótulo
                  pelo RESULTADO, nunca pela causa — ele não tem de caracterizar
                  se foi desconto, erro de previsão ou abatimento. */}
              <Botao
                variante={escolhaMenor === "quita" ? "primary" : "ghost"}
                onClick={() => setEscolhaMenor("quita")}
              >
                Quita o agendamento
              </Botao>
              <Botao
                variante={escolhaMenor === "falta" ? "primary" : "ghost"}
                onClick={() => setEscolhaMenor("falta")}
              >
                Falta pagar o resto
              </Botao>
              <Dica>Nenhum vem pré-selecionado, e os dois têm o mesmo peso.</Dica>

              {escolhaMenor === "quita" ? (
                <Dica>
                  O custo do ano é <strong>o pago</strong>. O agendamento fecha
                  sem resíduo — sem saldo e sem pendência pela diferença.
                </Dica>
              ) : null}

              {/* ⚠️ Critério 30: a quitação parcial PEDE a nova data do saldo.
                  Sem isso o saldo nasce vencido-sem-resposta e trava o
                  relatório anual PARA SEMPRE. */}
              {escolhaMenor === "falta" ? (
                <div className="flex flex-col gap-2">
                  <CampoTexto
                    campo="cSaldoData"
                    rotulo="Quando você pretende pagar o resto?"
                    tipo="date"
                    valor={dataSaldo}
                    onChange={(v) => {
                      setDataSaldo(v);
                      setSaldoSemData(false);
                    }}
                  />
                  <Botao
                    variante={saldoSemData ? "primary" : "ghost"}
                    onClick={() => {
                      setSaldoSemData(true);
                      setDataSaldo("");
                    }}
                  >
                    Ainda não sei — deixar sem data
                  </Botao>
                  <Dica>
                    <strong>&quot;Ainda não sei&quot; é resposta válida</strong>{" "}
                    e não trava nada — incerteza declarada não é silêncio. O
                    saldo <strong>não é custo de nada</strong> até sair da conta.
                  </Dica>
                </div>
              ) : null}
            </div>
          ) : null}

          <CampoArquivo
            campo="comprovante"
            rotulo="Comprovante"
            ajuda="O botão salva mesmo sem ele — o que muda é o estado que nasce."
            accept=".pdf,image/*"
            arquivo={comprovante}
            onChange={setComprovante}
          />
          {comprovante === null ? (
            <Banner cor={rotulosComprovante.gravidade} role="status">
              <strong>Vai salvar assim mesmo.</strong> Fica como{" "}
              <strong>{rotulosComprovante.consequencia}</strong>.
            </Banner>
          ) : null}
        </Card>

        <Card className="border-ink">
          <Passo>O que vai ser salvo</Passo>
          <Linha rotulo="Pagamento, na data acima">
            <span className="mono">
              {pagoCentavos === null ? "—" : formatarBRL(pagoCentavos)}
            </span>
          </Linha>
          {(encargosCentavos ?? 0) > 0 ? (
            <Linha rotulo="Juros e multa — registrados, fora do custo">
              <span className="mono">{formatarBRL(encargosCentavos ?? 0)}</span>
            </Linha>
          ) : null}
          {naoExplicadoCentavos > 0 ? (
            <Linha rotulo="Diferença sem explicação — fora do custo">
              <span className="mono text-red">
                {formatarBRL(naoExplicadoCentavos)}
              </span>
            </Linha>
          ) : null}
          <Dica>
            O agendamento <strong>não vira</strong> este pagamento: ele continua
            existindo, ligado a ele.
          </Dica>
        </Card>
      </ColunaDeDetalhe>

      <RodapeDeAcao>
        <BotaoSalvar ocupado={salvando} variante="primary" onClick={salvar} disabled={salvando || !podeSalvar}>
          {salvando
            ? "Salvando…"
            : progresso.pagamentoId !== null
              ? "Tentar de novo — só falta ligar ao agendamento"
              : data === ""
                ? "Informe a data em que o dinheiro saiu"
                : pagoCentavos === null || pagoCentavos <= 0
                  ? "Informe o valor efetivamente pago"
                  : pagouMenos && escolhaMenor === null
                    ? "Diga se quita ou se falta o resto"
                    : "Salvar pagamento"}
        </BotaoSalvar>
        {/* Critério 44: sair sem gravar não altera nada e não deixa rascunho. */}
        <BotaoLink href={`/compromisso/${compromisso.id}`}>
          Voltar sem salvar
        </BotaoLink>
      </RodapeDeAcao>
    </>
  );
}
