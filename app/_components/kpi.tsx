"use client";

/**
 * **CONTAI-040 — os três KPIs da Visão geral.**
 *
 * ⚠️ **Estes tiles são a home de ontem, inteira, em outra caixa.** O critério 8
 * do ticket é literal: *"TODAS as condicionais fiscais do card atual
 * reproduzidas verbatim — reduzir para o caminho feliz é regressão, não
 * simplificação"*. Toda frase abaixo é cópia do que `app/page.tsx` e
 * `app/_components/custo-em-risco.tsx` diziam em 21/09/2026, e toda ramificação
 * que existia lá existe aqui:
 *
 * - o zero do custo confirmado que **não aparece mudo** havendo registro
 *   (`EXPLICACAO_CUSTO_ZERO`, parecer §5.1);
 * - a **moldura que cai junto com o número**: sem terreno registrado, a linha
 *   "= situação em 31/12 na ficha Bens e Direitos" some, porque o número não
 *   serve para a declaração (ressalva do `contador`, Gate 2 do CONTAI-010);
 * - o que o portão do comprovante TIROU do acumulado, nomeado
 *   (`FORA_DO_CUSTO_CONFIRMADO`, CONTAI-025 §2.4 — item excluído em silêncio é
 *   o pior dos mundos);
 * - o gasto real com pendentes, que **não é o valor da declaração**;
 * - o "Terreno nesta soma: R$ 0,00" + `AvisoTerrenoSemRegistro`;
 * - a R4 do CONTAI-005 (o total do risco **nunca** sem a decomposição) e o
 *   estado ZERO, que não some;
 * - a trinca do INSS, em BASE, com a frase de fechamento que **não é opcional**
 *   (R2).
 *
 * ⚠️ **Nenhuma frase é redigida aqui.** Todas saem das constantes de
 * `lib/fiscal/risco.ts`, `lib/fiscal/terreno.ts` e `lib/fiscal/vinculo.ts`, ou
 * são cópia literal do texto que já estava em produção na home.
 */

import { AvisoTerrenoSemRegistro } from "@/app/_components/pendencias-derivadas";
import {
  Tile,
  TileDecomposicao,
  TileLinha,
  TileNota,
  TileNumero,
  TileRotulo,
} from "@/app/_components/painel";
import { Chip, Consequencia, Dica } from "@/app/_components/ui";
import {
  CUSTO_EM_RISCO_EXPLICACAO,
  CUSTO_EM_RISCO_TITULO,
  CUSTO_EM_RISCO_ZERO,
  INSS_CONTINUAM_VALENDO_NO_IRPF,
  INSS_EM_NOTAS,
  INSS_NAO_E_IMPOSTO,
  INSS_OUTRA_APURACAO,
  textoImpostoAte,
  tituloAfericaoInss,
  type CustoEmRiscoIr,
} from "@/lib/fiscal/risco";
import type { ResumoObra } from "@/lib/fiscal/resumo";
import {
  FORA_DO_CUSTO_CONFIRMADO,
  FORA_DO_CUSTO_CONFIRMADO_PORQUE,
} from "@/lib/fiscal/terreno";
import { EXPLICACAO_CUSTO_ZERO } from "@/lib/fiscal/vinculo";
import { formatarBRL } from "@/lib/money";

/**
 * KPI 1 — o custo que a declaração deste ano aceita.
 *
 * ⚠️ **CONTAI-060 — sob "todos os anos" o tile TROCA DE CAMPO, não de conta.** O
 * número passa a ser `acumuladoImovelCentavos`, que já existia e já era mostrado
 * logo abaixo; nada novo é somado (critério 3). A linha "Acumulado desta obra"
 * sai justamente porque ela repetiria o headline.
 *
 * O resto do tile não muda uma palavra: a moldura "31/12", "Terreno nesta soma",
 * "Gasto real" e as despesas comprovadas não nomeiam ano nenhum, e os valores já
 * saem certos porque `calcularResumo` recebe o ano real sob "todos" (spec do
 * designer, item 2).
 */
export function TileCustoConfirmado({
  resumo,
  nomeDaObra,
  ano,
}: {
  resumo: ResumoObra;
  nomeDaObra: string;
  /**
   * O ano EM EXIBIÇÃO — `null` = todos os anos. Separado de `resumo.ano`, que é
   * sempre um número concreto (sob "todos" ele é o ano real, de onde o acumulado
   * "até 31/12" é medido).
   */
  ano: number | null;
}) {
  const todosOsAnos = ano === null;
  /** O número do headline, e é o único que a escolha do ano troca. */
  const headlineCentavos = todosOsAnos
    ? resumo.acumuladoImovelCentavos
    : resumo.custoConfirmadoAnoCentavos;
  return (
    <Tile cor="grn" data-kpi="custo-confirmado">
      {/* Critério 9: todo número carrega o nome da obra. */}
      <TileRotulo>
        {todosOsAnos
          ? "Custo confirmado, acumulado em todos os anos"
          : `Custo confirmado em ${resumo.ano}`}{" "}
        · {nomeDaObra}
      </TileRotulo>
      <TileNumero cor="grn">{formatarBRL(headlineCentavos)}</TileNumero>

      {/* Critério 14: o zero NUNCA aparece mudo havendo registro na obra. O
          texto é cópia literal do parecer §5.1 — colapsar "não demonstrável"
          em "inexistente" é o defeito que o CONTAI-018 veio matar.
          ⚠️ A condição acompanha o campo mostrado (CONTAI-060): sob "todos os
          anos" o zero que precisa de explicação é o do acumulado. */}
      {headlineCentavos === 0 && resumo.temRegistro ? (
        <Consequencia cor="amb">
          {EXPLICACAO_CUSTO_ZERO} Ligue cada pagamento à sua nota na fila de
          pendências.
        </Consequencia>
      ) : null}

      {resumo.despesas.length > 0 ? (
        <TileNota>
          {resumo.despesas.length}{" "}
          {resumo.despesas.length === 1
            ? "despesa comprovada"
            : "despesas comprovadas"}{" "}
          — nota + pagamento ligados
        </TileNota>
      ) : null}

      {/* Omitida sob "todos os anos": ela É o headline nesse caso, e repetir o
          mesmo número duas vezes no mesmo tile é a D46 em miniatura — o mesmo
          fato com dois rostos (spec do designer, item 2). */}
      {todosOsAnos ? null : (
        <div className="mono mt-2 text-[14px] font-semibold">
          Acumulado desta obra: {formatarBRL(resumo.acumuladoImovelCentavos)}
        </div>
      )}

      {/* ⚠️ A MOLDURA CAI JUNTO COM O NÚMERO. Sem terreno registrado, chamar
          isto de "situação em 31/12 na ficha Bens e Direitos" é afirmar que o
          número serve para a declaração — e ele não serve. */}
      {resumo.terrenoSemRegistro === null ? (
        <TileNota>
          = situação em 31/12 na ficha Bens e Direitos (terreno + obra)
        </TileNota>
      ) : null}

      {/* ── CONTAI-025, critério 9 · o SEGUNDO número ─────────────────────
          O acumulado exclui o desembolso do terreno pago sem comprovante. Sem
          esta linha ele encolheria em SILÊNCIO, e o §2.4 do parecer diz que
          "item incluído em silêncio é o pior dos mundos; nomeado, é posição
          declarada" — e que isso vale nos DOIS sentidos, excluído também. */}
      {resumo.terrenoForaDoAcumuladoCentavos > 0 ? (
        <div className="mt-1.5" data-fora-do-custo-confirmado>
          <div className="text-[13px] font-semibold text-red">
            {FORA_DO_CUSTO_CONFIRMADO}:{" "}
            <span className="mono">
              {formatarBRL(resumo.terrenoForaDoAcumuladoCentavos)}
            </span>
          </div>
          <Dica>{FORA_DO_CUSTO_CONFIRMADO_PORQUE}</Dica>
        </div>
      ) : null}

      {/* Relato do Mateus, 2026-09-18: ele quer ver quanto já saiu do bolso,
          comprovado ou não — mas isso não pode virar o acumulado oficial (que
          É o valor da declaração e por isso só conta o que tem documento
          hábil). Linha nomeada e separada. */}
      {resumo.gastoRealComPendentesCentavos > resumo.acumuladoImovelCentavos ? (
        <div className="mt-1.5">
          <div className="mono text-[13px]">
            Gasto real até agora (com o que ainda não tem comprovante):{" "}
            {formatarBRL(resumo.gastoRealComPendentesCentavos)}
          </div>
          <Dica>
            Não é o valor da declaração — some quando o comprovante entrar.
          </Dica>
        </div>
      ) : null}

      {/* ⚠️ O R$ 0,00 do terreno NÃO é apuração — é a ausência dela. A parte do
          terreno aparece nomeada logo abaixo do acumulado para o "R$ 0,00
          aqui" do aviso apontar para um número visível, e não para a soma
          inteira. Sem isto, a linha afirma fato falso com moldura de fato
          apurado, e a direção do erro é a irreversível: custo subestimado =
          ganho de capital inflado. */}
      {resumo.terrenoSemRegistro ? (
        <>
          <div className="mono mt-1 text-[13px]">
            Terreno nesta soma:{" "}
            {formatarBRL(resumo.terrenoSemRegistro.terrenoNoAcumuladoCentavos)}
          </div>
          <AvisoTerrenoSemRegistro terreno={resumo.terrenoSemRegistro} />
        </>
      ) : null}

      <TileNota>
        Nada é somado com as outras obras — cada matrícula é um item da
        declaração.
      </TileNota>
    </Tile>
  );
}

/**
 * KPI 2 — **o headline, e o único número de "risco" da tela** (CONTAI-005).
 *
 * ⚠️ **R4 vira estrutura aqui**, como no card mobile: *"o total nunca aparece
 * sem a decomposição visível"*. O componente recebe o objeto inteiro e desenha
 * total, as TRÊS parcelas (mesmo zeradas) e a linha de imposto — não existe
 * prop que mostre só o número.
 *
 * ⚠️ **O tile NÃO some no zero** (decisão 3 do mock v5 do CONTAI-005): zero
 * risco de IR **não** é o mesmo fato que zero pendência — pode haver boleto e
 * nota sem CNO abertos e nenhum risco de IR. Sumir esconderia a confirmação.
 */
export function TileCustoEmRisco({
  risco,
  nomeDaObra,
}: {
  risco: CustoEmRiscoIr;
  nomeDaObra: string;
}) {
  const zerado = risco.totalCentavos === 0;
  return (
    <Tile
      cor={zerado ? "grn" : "red"}
      data-custo-em-risco={risco.totalCentavos}
      data-kpi="custo-em-risco"
    >
      <TileRotulo>
        {CUSTO_EM_RISCO_TITULO} · {nomeDaObra}
      </TileRotulo>
      <TileNumero cor={zerado ? "grn" : "red"}>
        {formatarBRL(risco.totalCentavos)}
      </TileNumero>
      {zerado ? (
        // Sem decomposição nem linha de imposto: não há o que decompor, e 15%
        // de zero não informa nada.
        <TileNota>{CUSTO_EM_RISCO_ZERO}</TileNota>
      ) : (
        <>
          <TileNota>{CUSTO_EM_RISCO_EXPLICACAO}</TileNota>
          {/* R4, bloqueante: a composição anda colada ao total, e as TRÊS
              parcelas aparecem mesmo quando uma delas é zero — a frase do
              Bloco 1 é uma só, e mostrar meia composição deixaria o leitor sem
              saber de onde veio o número.

              ⚠️ Os rótulos são os fragmentos LITERAIS da linha "Composto de:"
              da home, na mesma ordem. A tela larga permite uma linha por
              parcela; o que ela não permite é reescrever a parcela. */}
          <TileDecomposicao>
            <div className="mb-1">Composto de:</div>
            <TileLinha rotulo="pagos sem nota">
              {formatarBRL(risco.pagosSemNotaCentavos)}
            </TileLinha>
            <TileLinha rotulo="em nota fora do seu CPF">
              {formatarBRL(risco.notaForaDoCpfCentavos)}
            </TileLinha>
            <TileLinha rotulo="pagos sem comprovante">
              {formatarBRL(risco.pagosSemComprovanteCentavos)}
            </TileLinha>
          </TileDecomposicao>
          {/* R3: só com "até", com a fórmula visível e o disclaimer de
              redução/isenção — e aplicada EXCLUSIVAMENTE sobre a base de IRPF.
              Âmbar, não vermelho: é teto hipotético de imposto futuro, não
              fato consumado. */}
          <Consequencia cor="amb">
            {textoImpostoAte(risco.totalCentavos)}
          </Consequencia>
        </>
      )}
    </Tile>
  );
}

/**
 * KPI 3 — Bloco 2 do parecer: **em base, nunca em reais de imposto** (R2).
 *
 * ⚠️ **Só aparece com CNO**, mesma condição do card mobile: *"obra sem CNO:
 * esta linha cede lugar ao texto do parecer de 2026-08-09, item 4"* — que já
 * está em tela como `PendenciaCno`, hoje na fila unificada. Sem CNO o título
 * não teria número para citar e a ação seria inexequível.
 */
export function TileAfericaoInss({
  cno,
  baseCentavos,
}: {
  cno: string;
  baseCentavos: number;
}) {
  return (
    <Tile cor="amb" data-afericao-inss={baseCentavos} data-kpi="afericao-inss">
      <Chip cor="amb">{INSS_OUTRA_APURACAO}</Chip>
      <div className="mt-1.5 text-[13px] font-semibold">
        {tituloAfericaoInss(cno)}
      </div>
      <TileNumero cor="amb">{formatarBRL(baseCentavos)}</TileNumero>
      <TileNota>{INSS_EM_NOTAS}</TileNota>
      <Consequencia cor="amb">{INSS_NAO_E_IMPOSTO}</Consequencia>
      {/* ⚠️ NÃO É OPCIONAL (R2). É esta frase que impede o leitor de somar esta
          base ao headline com a própria cabeça — e a nota que está no CPF dele
          e foi paga é custo CONFIRMADO, não custo em risco. */}
      <Consequencia cor="grn">
        <strong>{INSS_CONTINUAM_VALENDO_NO_IRPF}</strong>
      </Consequencia>
    </Tile>
  );
}
