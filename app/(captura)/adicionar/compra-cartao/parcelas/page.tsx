"use client";

/**
 * LANÇAR PARCELAS EM LOTE — compra no cartão paga em N faturas (CONTAI-084).
 *
 * Fonte do desenho: `design/mocks/CONTAI-084.md` (nível 1, 4 fases numa página).
 * Fonte normativa: `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`,
 * ADENDO 5 §I.1-I.3 e ADENDO 9 §M.
 *
 * ⚠️ **ROTA IRMÃ de `/adicionar/compra-cartao`, nunca um "modo" dela**
 * (critério 2, decisão do `cto-obra`). E a separação não é organizacional: é o
 * que ISOLA a herança de nota. Esta rota **nunca lê `?documento=`** — e, desde
 * o CONTAI-089, a frase é mais forte do que "não lê": a única leitura de query
 * string deste arquivo é `lerTextoHerdado` (`../texto-herdado`), cujo retorno
 * são três STRINGS (`nome`, `documento`, `valor`) consumidas exclusivamente
 * como valor inicial de `useState`. Não há id de documento para ler porque o
 * link de entrada não manda nenhum — a garantia é do transporte, não da
 * disciplina de quem chama. Quem acrescentar aqui leitura de id, ou passar o
 * retorno de `lerTextoHerdado` para qualquer lugar que não seja um `useState`,
 * está reabrindo o critério 10 pelo lado de fora.
 *
 * ⚠️ **Nenhuma parcela nasce com `documento_origem_id`** — critério 10 e Gate
 * Fiscal. Não é disciplina desta tela: a RPC `compra_cartao_gravar_lote`
 * (migration 0026) não tem o parâmetro. Mesmo que exista uma nota única
 * cobrindo o valor total, o vínculo é ato deliberado posterior, uma parcela de
 * cada vez, em `/compromisso/[id]/pre-vincular` (CONTAI-080/081). O motivo está
 * por extenso na 0026: herança em massa escalaria o incidente P0 do CONTAI-083
 * para 24 parcelas numa única ação.
 *
 * ⚠️ **Não existe campo "Parcelado?" aqui** (critério 5), e a ausência é
 * justificada, não esquecida: cada linha gerada JÁ É o estado-alvo que o ADENDO
 * 5 §I.1 prescreve como saída da recusa de parcelado — uma compra separada por
 * fatura, à vista por definição daquela linha. A `Dica` fixa diz isso na tela.
 *
 * Cenário: **gestão** (em casa, sentado). O "Teste do Canteiro" não se aplica —
 * densidade de até 24 linhas editáveis é aceitável, e `/adicionar/compra-cartao`
 * (captura individual) continua intocada (critério 19).
 */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import { CampoTexto, ErroCampo, Rotulo } from "@/app/_components/campos";
import { CamposCurtos, COLUNA_DO_FORMULARIO } from "@/app/_components/captura";
import { AfirmacaoObra, TelaTrocarObra } from "@/app/_components/obra";
import { useSessao } from "@/app/_components/sessao";
import { useObraDoRegistro } from "@/app/_components/usar-obra-do-registro";
import {
  AppBar,
  Banner,
  Botao,
  BotaoLink,
  BotaoSalvar,
  Card,
  Carregando,
  Corpo,
  Dica,
  ErroDeGravacao,
  EstadoErro,
  Linha,
  Rodape,
} from "@/app/_components/ui";
import {
  classificarErro,
  criarCompraCartaoEmLote,
  garantirFavorecido,
  mensagemDeErroDeGravacao,
} from "@/lib/data";
import {
  RESSALVA_ANO_DA_FATURA,
  RESSALVA_ANO_DA_FATURA_TITULO,
} from "@/lib/fiscal/fatura";
import { soDigitos, tipoPorDocumento } from "@/lib/fiscal/identificacao";
import { formatarDataBR } from "@/lib/fiscal/obra";
import {
  conferirSoma,
  dividirCentavos,
  LOTE_ABAIXO_DO_MINIMO,
  LOTE_ACIMA_DO_MAXIMO,
  LOTE_BANNER_AGENDAMENTO,
  LOTE_DICA_SEM_PARCELADO,
  MAXIMO_DE_PARCELAS,
  MINIMO_DE_PARCELAS,
  somaDasParcelas,
  validarLoteCompraCartao,
  vencimentosSugeridos,
  type EntradaLoteCompraCartao,
} from "@/lib/fiscal/parcelamento";
import { hojeIso } from "@/lib/hoje";
import { centavosParaInput, formatarBRL, parseValorInput } from "@/lib/money";

import { lerTextoHerdado, type TextoHerdado } from "../texto-herdado";

/** Esta rota, sem query nenhuma — o destino do `replace` da fase de sucesso. */
const ROTA_DO_LOTE = "/adicionar/compra-cartao/parcelas";

const SEM_HERANCA: TextoHerdado = { nome: "", documento: "", valor: "" };

/**
 * CONTAI-089 — a origem do que está no campo, dita no próprio campo. Mesmo
 * padrão (e mesma razão) de `ajudaDoValorDaNota`: campo preenchido pelo app sem
 * dizer de onde veio lê como algo que o usuário digitou e conferiu, e não foi.
 *
 * ⚠️ **Por campo, nunca um interruptor para os três**: editar o nome não
 * desmente a origem do CNPJ. E a ajuda SOME ao editar — texto de origem que
 * sobrevive à edição é mentira sobre a origem do dado.
 *
 * O que ela NÃO diz, de propósito: nada sobre vínculo com nota. Não há vínculo
 * nenhum aqui — a `Dica` fixa da tela e a da fase de sucesso cobrem isso, e o
 * Gate Fiscal deste ticket é explícito em que "campo preenchido afirma" (ADENDO
 * 7 §K.3) é doutrina sobre *vínculo*, não sobre *dígitos repetidos*.
 */
const AJUDA_HERDADA = "Vem da compra que você estava registrando. Dá para trocar.";

function ajudaHerdada(herdado: string, atual: string): string | undefined {
  return herdado !== "" && atual === herdado ? AJUDA_HERDADA : undefined;
}

/** O texto de hoje do "Valor total" — mantido byte a byte (critério 4). */
const AJUDA_VALOR_TOTAL =
  "O total da compra. Ele é dividido entre as parcelas, e o resíduo de centavos vai para a última.";

/** Uma linha da Tela 2 — valor e vencimento SEMPRE editáveis (critério 9). */
interface LinhaDaParcela {
  valorTexto: string;
  vencimento: string;
  /**
   * `"ajustada — abril não tem dia 31"` (critério 8), ou `null`. **Editar a
   * data não apaga a etiqueta** (spec, §3): ela conta o que o gerador fez, e
   * esse fato não deixa de ter acontecido porque o Mateus mexeu depois.
   */
  etiqueta: string | null;
}

interface ParcelaGravada {
  compromissoId: string;
  faturaId: string;
  valorCentavos: number;
  dataVencimento: string;
}

type Fase =
  | { nome: "formulario" }
  | { nome: "revisao" }
  | { nome: "salvando" }
  | { nome: "sucesso"; favorecidoNome: string; itens: ParcelaGravada[] };

/** `"3"` → 3; `"3,5"`, `""` e `"abc"` → `null`. Nunca assume nada. */
function parseInteiro(texto: string): number | null {
  const limpo = texto.trim();
  if (!/^\d+$/.test(limpo)) return null;
  const n = Number(limpo);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * O stepper de N — critério 4. Inteiro, de 2 a 24, **nascendo vazio**: campo
 * que nasce com um número é campo que afirma por quem não digitou (a doutrina
 * do CONTAI-034), e "2" pré-escolhido seria o lote mais comum virando default
 * silencioso. Os botões clampam no intervalo; quem digita fora dele vê a
 * mensagem nomeada do extremo correspondente.
 */
function StepperDeParcelas({
  valor,
  onChange,
  erro,
}: {
  valor: string;
  onChange: (v: string) => void;
  erro?: string;
}) {
  const atual = parseInteiro(valor);
  const passo = (delta: number) => {
    const base = atual ?? MINIMO_DE_PARCELAS - delta;
    const proximo = Math.min(
      MAXIMO_DE_PARCELAS,
      Math.max(MINIMO_DE_PARCELAS, base + delta),
    );
    onChange(String(proximo));
  };
  return (
    <div className="flex flex-col gap-1">
      <Rotulo>Número de parcelas</Rotulo>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Uma parcela menos"
          onClick={() => passo(-1)}
          className="min-h-[44px] w-[44px] flex-none rounded-lg border border-line bg-white text-[18px] font-semibold"
        >
          −
        </button>
        <input
          data-campo="lParcelas"
          aria-label="Número de parcelas"
          value={valor}
          inputMode="numeric"
          placeholder="de 2 a 24"
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={erro ? true : undefined}
          className={`min-h-[44px] w-full min-w-0 rounded-lg border bg-white px-3 text-center text-[16px] ${
            erro ? "border-red" : "border-line"
          }`}
        />
        <button
          type="button"
          aria-label="Uma parcela mais"
          onClick={() => passo(1)}
          className="min-h-[44px] w-[44px] flex-none rounded-lg border border-line bg-white text-[18px] font-semibold"
        >
          +
        </button>
      </div>
      <p className="text-[12px] text-mut">
        Cada parcela vira uma compra separada, na fatura em que ela vence.
      </p>
      <ErroCampo mensagem={erro} />
    </div>
  );
}

/**
 * Uma linha da revisão. **Um único JSX para as duas larguras** (lição do
 * CONTAI-039/047): a partir de `larga` é linha de tabela compacta (~40px); no
 * piso vira cartão empilhado com os mesmos 3 dados, sem perder a edição.
 *
 * O nome acessível de cada campo vem de `aria-label` com o NÚMERO da parcela —
 * o rótulo visível de cima some em `larga` (o cabeçalho da tabela o substitui),
 * e nome acessível que depende de largura de tela não é nome acessível.
 */
function LinhaDeRevisao({
  numero,
  linha,
  onValor,
  onVencimento,
  erro,
}: {
  numero: number;
  linha: LinhaDaParcela;
  onValor: (v: string) => void;
  onVencimento: (v: string) => void;
  erro?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-line bg-white px-[14px] py-2.5 larga:grid larga:grid-cols-[34px_minmax(0,1fr)_minmax(0,1fr)] larga:items-center larga:gap-3 larga:rounded-none larga:border-0 larga:border-b larga:border-line larga:px-0 larga:py-1.5">
      <div className="flex items-baseline gap-1.5">
        <span aria-hidden="true" className="text-[11.5px] text-mut larga:hidden">
          Parcela
        </span>
        <span className="mono text-[13px] font-bold">{numero}</span>
      </div>
      <div className="flex flex-col gap-1">
        <span aria-hidden="true" className="text-[11px] text-mut larga:hidden">
          Vencimento
        </span>
        <input
          data-campo="lVencParcela"
          aria-label={`Vencimento da parcela ${numero}`}
          type="date"
          value={linha.vencimento}
          onChange={(e) => onVencimento(e.target.value)}
          className="min-h-[40px] w-full min-w-0 rounded-lg border border-line bg-white px-2 text-[16px] larga:text-[13.5px]"
        />
      </div>
      <div className="flex flex-col gap-1">
        <span aria-hidden="true" className="text-[11px] text-mut larga:hidden">
          Valor (R$)
        </span>
        <input
          data-campo="lValorParcela"
          aria-label={`Valor da parcela ${numero}`}
          value={linha.valorTexto}
          inputMode="decimal"
          onChange={(e) => onValor(e.target.value)}
          className="min-h-[40px] w-full min-w-0 rounded-lg border border-line bg-white px-2 text-right text-[16px] larga:text-[13.5px]"
        />
      </div>
      {/* Critério 8 — o ajuste de calendário é NOMEADO na linha dele. Ocupa as
          três colunas na tela larga para não comprimir os campos. */}
      {linha.etiqueta ? (
        <p className="text-[11.5px] font-semibold text-amb larga:col-span-3">
          {linha.etiqueta}
        </p>
      ) : null}
      {erro ? (
        <p role="alert" className="text-[11.5px] font-semibold text-red larga:col-span-3">
          {erro}
        </p>
      ) : null}
    </div>
  );
}

function LancarParcelasEmLote({
  herdarDaUrl,
  aoLancarOutroLote,
}: {
  /**
   * CONTAI-089, critério 10 — se o TEXTO da query string vale para ESTA rodada.
   * Só a primeira herda: depois de "Lançar outro lote" o componente remonta e o
   * lote novo nasce em branco, sem depender de o `router.replace` já ter
   * chegado ao `useSearchParams` (a navegação é assíncrona, e o primeiro render
   * da rodada nova ainda veria o texto antigo). Mesmo padrão de `herdarDaUrl`
   * em `compra-cartao/page.tsx`, pelo mesmo motivo (CONTAI-071).
   */
  herdarDaUrl: boolean;
  /** Troca a `key` e remonta a tela do zero — padrão de `aoRegistrarOutra`. */
  aoLancarOutroLote: () => void;
}) {
  const router = useRouter();
  /**
   * `useSearchParams` e não `window.location`: chegando por navegação
   * client-side (que é o caso — o clique vem do link da tela anterior), o
   * `location` ainda não tem a query no primeiro render e a herança
   * desapareceria sem aviso. O custo é a fronteira de `Suspense` no fim do
   * arquivo, igual à de `compra-cartao/page.tsx`.
   */
  const params = useSearchParams();
  const registro = useObraDoRegistro();
  const { pedirReautenticacao } = useSessao();
  const obra = registro.obra;
  const [trocando, setTrocando] = useState(false);
  const [fase, setFase] = useState<Fase>({ nome: "formulario" });
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  /**
   * ⚠️ O TEXTO herdado da tela anterior, lido UMA vez na montagem — e `useState`
   * com inicializador, não derivação por render: a URL é limpa pelo
   * `router.replace` da fase de sucesso, e um valor recalculado a cada render
   * mudaria de significado no meio do fluxo.
   *
   * Três strings, nada mais. **Não existe id de documento aqui** (critério 7):
   * a tela anterior não manda nenhum, e nada deste componente procura um.
   */
  const [herdado] = useState<TextoHerdado>(() =>
    herdarDaUrl ? lerTextoHerdado(params) : SEM_HERANCA,
  );

  // ── Os campos comuns, preenchidos UMA vez (critério 4) ────────────────
  // ⚠️ Herdar aqui é a MESMA exceção ao "SEM DEFAULT" já aberta pelo CONTAI-064
  // (dado replicado de fonte real, com a origem visível na `ajuda`) — e os três
  // continuam `CampoTexto` comum, editáveis, sem nada de `FavorecidoHerdado`
  // (que é travado em `compra-cartao` porque LÁ existe vínculo; aqui não existe
  // vínculo nenhum para travar nada — critério 2 e Pre-mortem 3).
  const [nome, setNome] = useState(herdado.nome);
  const [documento, setDocumento] = useState(herdado.documento);
  const [dataCompra, setDataCompra] = useState("");
  /** A SEMENTE do gerador de datas — campo separado da data da compra. */
  const [sementeVencimento, setSementeVencimento] = useState("");
  // ⚠️ **O valor herdado é o SALDO da nota**, calculado por
  // `sugerirValorDaNota` na tela anterior — nunca o `valorCentavos` de face.
  // Quem monta a query garante isso (critério 9); aqui chega como texto.
  const [valorTotal, setValorTotal] = useState(herdado.valor);
  const [quantas, setQuantas] = useState("");

  // ── A lista gerada, viva entre revisao → salvando → erro → revisao ────
  const [parcelas, setParcelas] = useState<LinhaDaParcela[]>([]);
  /** Houve edição manual de linha? Decide se voltar à Tela 1 confirma antes. */
  const [editouLinha, setEditouLinha] = useState(false);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);

  const totalCentavos = parseValorInput(valorTotal);
  const n = parseInteiro(quantas);
  const tipoFavorecido = useMemo(() => tipoPorDocumento(documento), [documento]);

  const erroDeN =
    n === null
      ? undefined
      : n < MINIMO_DE_PARCELAS
        ? LOTE_ABAIXO_DO_MINIMO
        : n > MAXIMO_DE_PARCELAS
          ? LOTE_ACIMA_DO_MAXIMO
          : undefined;

  /** Nomeia o PRIMEIRO campo que falta — padrão `faltando` de `compra-cartao`. */
  const faltando =
    nome.trim().length < 2
      ? "o favorecido"
      : tipoFavorecido === null
        ? "o CNPJ/CPF"
        : totalCentavos === null
          ? "o valor total"
          : !dataCompra
            ? "a data da compra"
            : !sementeVencimento
              ? "o vencimento da 1ª fatura"
              : n === null
                ? "o número de parcelas"
                : null;
  const podeGerar = faltando === null && erroDeN === undefined;

  const entradaDoLote: EntradaLoteCompraCartao = useMemo(
    () => ({
      favorecidoNome: nome,
      favorecidoDocumento: documento,
      dataCompra,
      valorTotalCentavos: totalCentavos,
      parcelas: parcelas.map((p) => ({
        valorCentavos: parseValorInput(p.valorTexto),
        dataVencimento: p.vencimento,
      })),
    }),
    [nome, documento, dataCompra, totalCentavos, parcelas],
  );

  const errosDoLote = validarLoteCompraCartao(entradaDoLote);
  const podeConfirmar = errosDoLote.length === 0;
  const soma = conferirSoma(
    somaDasParcelas(entradaDoLote.parcelas),
    totalCentavos ?? 0,
  );
  const erroDaLinha = (numero: number) =>
    errosDoLote.find((e) => e.escopo === "parcela" && e.numero === numero)
      ?.mensagem;

  function gerar() {
    if (!podeGerar || totalCentavos === null || n === null) return;
    const valores = dividirCentavos(totalCentavos, n);
    const datas = vencimentosSugeridos(sementeVencimento, n);
    setParcelas(
      valores.map((centavos, i) => ({
        valorTexto: centavosParaInput(centavos),
        vencimento: datas[i].data,
        etiqueta: datas[i].etiqueta,
      })),
    );
    setEditouLinha(false);
    setConfirmandoDescarte(false);
    setErroSalvar(null);
    setFase({ nome: "revisao" });
  }

  function editarLinha(i: number, muda: (l: LinhaDaParcela) => LinhaDaParcela) {
    setEditouLinha(true);
    setParcelas((atuais) => atuais.map((l, j) => (j === i ? muda(l) : l)));
  }

  function voltarAosDadosComuns() {
    // Spec, §1: regenerar descarta as edições de linha — então confirma antes.
    if (editouLinha && !confirmandoDescarte) {
      setConfirmandoDescarte(true);
      return;
    }
    setConfirmandoDescarte(false);
    setErroSalvar(null);
    setFase({ nome: "formulario" });
  }

  async function confirmar() {
    setErroSalvar(null);
    if (!obra || !podeConfirmar || totalCentavos === null) return;

    setFase({ nome: "salvando" });
    try {
      if (tipoFavorecido === null) throw new Error("CNPJ/CPF inválido.");
      const favorecidoId = await garantirFavorecido({
        nome: nome.trim(),
        // ⚠️ SÓ DÍGITOS, como nas outras telas: a dedup de `garantirFavorecido`
        // é pela chave (dono, DOCUMENTO), e gravar a máscara criaria um SEGUNDO
        // favorecido com o mesmo CNPJ — a ficha Pagamentos Efetuados sairia com
        // a mesma empresa em duas linhas.
        documento: soDigitos(documento),
        tipo: tipoFavorecido,
      });
      const linhas = entradaDoLote.parcelas.map((p) => ({
        valorCentavos: p.valorCentavos as number,
        dataVencimentoFatura: p.dataVencimento,
      }));
      const gravadas = await criarCompraCartaoEmLote({
        obraId: obra.id,
        favorecidoId,
        dataCompra,
        valorTotalCentavos: totalCentavos,
        parcelas: linhas,
        // ⚠️ Não há `documentoOrigemId` para passar — critério 10 por
        // assinatura: nem `NovoLoteCompraCartao` (`lib/data.ts`) nem a RPC
        // `compra_cartao_gravar_lote` (migration 0026) têm o parâmetro. O
        // CONTAI-089 não o acrescentou: o que ele herda não chega até aqui —
        // morre nos `useState` da Tela 1, como texto.
      });
      /**
       * CONTAI-089, critério 10 — a query string sai da barra ANTES de a tela
       * de sucesso aparecer: um F5 ali ressuscitaria o texto herdado por cima
       * de um lote já gravado. `replace` e não `push` (nada a empilhar), e o
       * `scroll: false` porque a troca de fase já reposiciona a tela.
       *
       * ⚠️ Isto é cinto E suspensório com o `herdarDaUrl={rodada === 0}`: a
       * navegação é assíncrona, então "Lançar outro lote" não pode depender de
       * o `replace` ter chegado — quem garante a rodada 2 em branco é a `key`.
       */
      router.replace(ROTA_DO_LOTE, { scroll: false });
      setFase({
        nome: "sucesso",
        favorecidoNome: nome.trim(),
        itens: gravadas.map((g, i) => ({
          ...g,
          valorCentavos: linhas[i].valorCentavos,
          dataVencimento: linhas[i].dataVencimentoFatura,
        })),
      });
    } catch (erro) {
      // Volta à revisão com a MESMA lista editada — nada se perde (spec, §1).
      setFase({ nome: "revisao" });
      if (classificarErro(erro).tipo === "sem_sessao") {
        pedirReautenticacao();
        return;
      }
      setErroSalvar(
        mensagemDeErroDeGravacao(
          erro,
          "as listas de compras das faturas destas parcelas",
        ),
      );
    }
  }

  // ══ Tela 3 — sucesso (critério 18) ═════════════════════════════════════
  if (fase.nome === "sucesso") {
    const quantidade = fase.itens.length;
    return (
      <>
        <AppBar
          titulo="Parcelas lançadas"
          sub={`${quantidade} parcelas · ${fase.favorecidoNome}`}
        />
        <Corpo className={COLUNA_DO_FORMULARIO}>
          <Banner cor="amb" role="status">
            <strong>{quantidade} parcelas agendadas.</strong> Nada entrou em
            custo ainda.
          </Banner>
          <Card className="flex flex-col">
            {fase.itens.map((item, i) => {
              /**
               * Mesma regra `faturaVencida` de hoje (CONTAI-066): comparação
               * lexicográfica de ISO. Vencido ≠ pago — isto não afirma que a
               * fatura foi paga, só muda para onde o wayfinding aponta.
               */
              const vencida = item.dataVencimento <= hojeIso();
              return (
                <Linha key={item.compromissoId} rotulo={`Parcela ${i + 1}`}>
                  <span className="mono">
                    {formatarDataBR(item.dataVencimento)}
                  </span>{" "}
                  · <span className="mono">{formatarBRL(item.valorCentavos)}</span>{" "}
                  ·{" "}
                  <Link
                    href={
                      vencida
                        ? `/fatura/${item.faturaId}/confirmar`
                        : `/fatura/${item.faturaId}`
                    }
                    className="font-semibold underline"
                  >
                    {vencida ? "Confirmar o pagamento" : "Ver a fatura"}
                  </Link>
                </Linha>
              );
            })}
          </Card>
          <Dica>
            Nenhuma delas está ligada a nota. O vínculo é feito depois, parcela
            por parcela, no pré-vínculo de cada agendamento.
          </Dica>
          {/* Critério 18: banner ÚNICO, nunca repetido por linha. */}
          <Banner cor="red" role="status">
            ⚠️ <strong>{RESSALVA_ANO_DA_FATURA_TITULO}</strong>{" "}
            {RESSALVA_ANO_DA_FATURA}
          </Banner>
        </Corpo>
        <Rodape className={COLUNA_DO_FORMULARIO}>
          <Botao variante="ghost" onClick={aoLancarOutroLote}>
            Lançar outro lote
          </Botao>
          <BotaoLink href="/">Voltar ao início</BotaoLink>
        </Rodape>
      </>
    );
  }

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

  // ══ Tela 2 — revisão (critério 9) ══════════════════════════════════════
  if (fase.nome === "revisao" || fase.nome === "salvando") {
    const salvando = fase.nome === "salvando";
    return (
      <>
        <AppBar
          titulo="Revisar as parcelas"
          sub={`${parcelas.length} parcelas · total de ${formatarBRL(totalCentavos ?? 0)}`}
        />
        <Corpo>
          {erroSalvar ? (
            <ErroDeGravacao
              mensagem={erroSalvar}
              antes="Não deu para gravar o lote. "
              depois=" Nenhuma parcela entrou — é tudo ou nada —, e a lista continua aqui como você editou."
            />
          ) : null}

          {/* Resumo fixo dos dados comuns, só leitura (spec, §3). */}
          <Card className="flex flex-col">
            <Linha rotulo="Favorecido">{nome.trim()}</Linha>
            <Linha rotulo="Documento">
              <span className="mono">{documento}</span>
            </Linha>
            <Linha rotulo="Data da compra">
              <span className="mono">{formatarDataBR(dataCompra)}</span>
            </Linha>
            <div className="pt-2">
              <Botao
                variante="ghost"
                disabled={salvando}
                onClick={voltarAosDadosComuns}
              >
                Editar dados comuns
              </Botao>
            </div>
            {confirmandoDescarte ? (
              <div className="mt-2 flex flex-col gap-2">
                <Banner cor="amb" role="alert">
                  Você editou valores ou datas à mão. Voltar e gerar de novo
                  descarta essas edições.
                </Banner>
                <Botao variante="ghost" onClick={voltarAosDadosComuns}>
                  Descartar as edições e voltar
                </Botao>
                <Botao
                  variante="ghost"
                  onClick={() => setConfirmandoDescarte(false)}
                >
                  Continuar revisando
                </Botao>
              </div>
            ) : null}
          </Card>

          {/* Cabeçalho da tabela — `sticky` porque 24 linhas não cabem na
              altura útil (spec, §3). Só existe na tela larga: no piso cada
              linha é um cartão com os rótulos dentro. */}
          <div className="sticky top-0 z-10 hidden bg-paper larga:grid larga:grid-cols-[34px_minmax(0,1fr)_minmax(0,1fr)] larga:gap-3 larga:border-b larga:border-ink larga:pb-1.5">
            <span className="text-[11px] text-mut uppercase">#</span>
            <span className="text-[11px] text-mut uppercase">Vencimento</span>
            <span className="text-right text-[11px] text-mut uppercase">
              Valor (R$)
            </span>
          </div>

          <div className="flex flex-col gap-2 larga:gap-0">
            {parcelas.map((linha, i) => (
              <LinhaDeRevisao
                key={i}
                numero={i + 1}
                linha={linha}
                erro={erroDaLinha(i + 1)}
                onValor={(v) =>
                  editarLinha(i, (l) => ({ ...l, valorTexto: v }))
                }
                onVencimento={(v) =>
                  editarLinha(i, (l) => ({ ...l, vencimento: v }))
                }
              />
            ))}
          </div>

          {/* Linha de totais — `sticky bottom`, dentro do corpo que rola. */}
          <div className="sticky bottom-0 z-10 flex flex-col gap-1 border-t border-ink bg-paper py-2">
            <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
              <span className="text-mut">Soma das parcelas</span>
              <span className="mono font-bold">
                {formatarBRL(somaDasParcelas(entradaDoLote.parcelas))} de{" "}
                {formatarBRL(totalCentavos ?? 0)}
              </span>
            </div>
            {soma.estado === "bate" ? (
              <p role="status" className="text-[12px] font-semibold text-grn">
                A soma bate com o valor total.
              </p>
            ) : (
              <p
                role="status"
                className={`text-[12px] font-semibold ${
                  soma.estado === "falta" ? "text-amb" : "text-red"
                }`}
              >
                {soma.mensagem}
              </p>
            )}
          </div>
        </Corpo>
        <Rodape>
          <BotaoSalvar
            ocupado={salvando}
            onClick={confirmar}
            disabled={salvando || !podeConfirmar}
          >
            {salvando
              ? "Salvando…"
              : erroSalvar
                ? "Tentar de novo"
                : podeConfirmar
                  ? `Confirmar as ${parcelas.length} parcelas`
                  : (errosDoLote[0]?.mensagem ??
                    "Ajuste as parcelas para continuar")}
          </BotaoSalvar>
          {/* O mesmo ato do link no resumo, ao alcance do polegar depois de
              rolar 24 linhas. Rótulo igual ao de lá de propósito: dois nomes
              para a mesma ação leem como duas ações. */}
          <Botao
            variante="ghost"
            disabled={salvando}
            onClick={voltarAosDadosComuns}
          >
            Editar dados comuns
          </Botao>
        </Rodape>
      </>
    );
  }

  // ══ Tela 1 — campos comuns (critérios 4, 5 e 6) ════════════════════════
  return (
    <>
      <AppBar titulo="Lançar parcelas em lote" sub="Compra no cartão" />
      <Corpo className={COLUNA_DO_FORMULARIO}>
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

            {/* Critério 6 — texto verbatim, pluralização ratificada pelo
                `contador`. A constante mora em `lib/fiscal/parcelamento.ts`. */}
            <Banner cor="amb" role="status">
              {LOTE_BANNER_AGENDAMENTO}
            </Banner>

            <Card className="flex flex-col gap-3.5">
              <CamposCurtos>
                <CampoTexto
                  campo="lFavorecido"
                  rotulo="Favorecido"
                  valor={nome}
                  onChange={setNome}
                  placeholder="O lojista — nunca o banco ou a administradora"
                  ajuda={ajudaHerdada(herdado.nome, nome)}
                />
                <CampoTexto
                  campo="lFavorecidoDocumento"
                  rotulo={
                    tipoFavorecido === "pf"
                      ? "CPF do favorecido"
                      : "CNPJ / CPF do favorecido"
                  }
                  valor={documento}
                  onChange={setDocumento}
                  inputMode="numeric"
                  placeholder="00.000.000/0000-00"
                  ajuda={ajudaHerdada(herdado.documento, documento)}
                />
              </CamposCurtos>
              <CampoTexto
                campo="lValorTotal"
                rotulo="Valor total da compra"
                valor={valorTotal}
                onChange={setValorTotal}
                inputMode="decimal"
                placeholder="0,00"
                /* Os DOIS textos quando o valor vem herdado: a origem some ao
                   editar, mas a regra do resíduo de centavos continua valendo
                   em qualquer caso — ela explica o que o botão "Gerar" vai
                   fazer, e não de onde o número saiu. */
                ajuda={
                  ajudaHerdada(herdado.valor, valorTotal)
                    ? `${AJUDA_HERDADA} ${AJUDA_VALOR_TOTAL}`
                    : AJUDA_VALOR_TOTAL
                }
              />
              <CamposCurtos>
                <CampoTexto
                  campo="lCompra"
                  rotulo="Data da compra"
                  tipo="date"
                  valor={dataCompra}
                  onChange={setDataCompra}
                  ajuda="A data da compra é só registro."
                />
                <CampoTexto
                  campo="lVenc1"
                  rotulo="Vencimento da 1ª fatura"
                  tipo="date"
                  valor={sementeVencimento}
                  onChange={setSementeVencimento}
                  ajuda="O vencimento da 1ª fatura é a semente: as próximas vencem no mesmo dia dos meses seguintes."
                />
              </CamposCurtos>
              <StepperDeParcelas
                valor={quantas}
                onChange={setQuantas}
                erro={erroDeN}
              />
              {/* Critério 5 — a AUSÊNCIA do campo "Parcelado?", explicada.
                  Texto verbatim, ratificado pelo `contador`. */}
              <Dica>{LOTE_DICA_SEM_PARCELADO}</Dica>
            </Card>
          </>
        ) : null}
      </Corpo>
      {registro.fase === "pronta" ? (
        <Rodape className={COLUNA_DO_FORMULARIO}>
          {/* `Botao` e não `BotaoSalvar`: gerar a lista não vai à rede — não há
              gravação para ficar "ocupada", e o aviso de não recarregar seria
              falso aqui. Quem grava é a Tela 2. */}
          <Botao variante="ghost" onClick={gerar} disabled={!podeGerar}>
            {erroDeN
              ? erroDeN
              : faltando
                ? `Informe ${faltando} para continuar`
                : `Gerar as ${n} parcelas →`}
          </Botao>
          <BotaoLink href="/adicionar/compra-cartao">Voltar</BotaoLink>
        </Rodape>
      ) : (
        <Rodape className={COLUNA_DO_FORMULARIO}>
          <BotaoLink href="/adicionar/compra-cartao">Voltar</BotaoLink>
        </Rodape>
      )}
    </>
  );
}

/**
 * ⚠️ **Nenhum estado do formulário mora aqui**, pelo mesmo motivo escrito em
 * `compra-cartao/page.tsx`: é o que faz o incremento de `rodada` zerar a tela
 * inteira — inclusive o que um ticket futuro acrescentar lá dentro. Estado novo
 * entra em `LancarParcelasEmLote`.
 *
 * ⚠️ O `Suspense` entrou no CONTAI-089 — exigência do `useSearchParams` no Next
 * 16, e o único motivo dele. O que a rota lê continua sendo **texto e nada
 * mais** (critério 7): o comentário do topo do arquivo diz por extenso o que
 * `lerTextoHerdado` pode e não pode fazer.
 */
export default function Pagina() {
  const [rodada, setRodada] = useState(0);
  return (
    <Suspense fallback={<Carregando rotulo="Carregando a obra" />}>
      <LancarParcelasEmLote
        key={rodada}
        herdarDaUrl={rodada === 0}
        aoLancarOutroLote={() => setRodada((r) => r + 1)}
      />
    </Suspense>
  );
}
