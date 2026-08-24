/**
 * CONTAI-021 — a regra da CORREÇÃO de um registro já gravado.
 *
 * Fonte normativa: `docs/pareceres/2026-08-18-correcao-de-documento-registrado.md`
 * (§§1-7 e o ADENDO de 2026-08-19). Texto de tela com consequência fiscal é
 * COPIADO daqui, e o que está aqui foi copiado do parecer — não reescrito.
 *
 * Este módulo é PURO: recebe o painel e o "hoje" por parâmetro, e devolve o que
 * a tela mostra antes de gravar e o que a função Postgres grava. Quem grava é
 * `lib/data.ts`; quem torna a gravação atômica é a migration 0009.
 *
 * ⚠️ **Nada aqui altera `lib/fiscal/vinculo.ts`.** `alocarCusto` continua sendo
 * a única implementação da regra fiscal central (`min(Σ pagamentos,
 * Σ documentos hábeis)` por componente conexo, dentro de UMA obra). O
 * "antes → depois" desta tela é a MESMA função rodada duas vezes, sobre uma
 * cópia — nunca uma segunda conta de custo. Duas implementações da mesma regra
 * divergem sempre, e a que fica é a que produz o número da home (Gate 2 do
 * CONTAI-018).
 */

import type {
  AnoAfetado,
  Documento,
  MotivoRevisao,
  Pagamento,
  PendenciaPersistente,
  Revisao,
} from "@/lib/types";

import { anoCalendario } from "./pagamento";
import {
  alocarCusto,
  custoComprovadoDoAno,
  ehDocumentoHabil,
  type Alocacao,
  type EntradaAlocacao,
} from "./vinculo";

// ── Textos com consequência fiscal ───────────────────────────────────────

/**
 * O desfecho (i) do critério 13, na redação decidida pelo `po` em 19/08 e
 * ratificada pelo `contador` no adendo §5.2: **é o único desfecho que
 * transfere custo entre obras**.
 */
export const DESFECHO_VAI_JUNTO =
  "Vai junto com a nota. O par pagamento↔nota continua inteiro, só muda de " +
  "imóvel: sai do custo de aquisição de um bem e entra no do outro, sem que o " +
  "seu gasto mude um centavo.";

/**
 * O desfecho (ii). ⚠️ Ele **não pode sugerir prejuízo nem erro do Mateus**
 * (ressalva 3 do `contador`): o pagamento continua sendo dispêndio da obra de
 * origem — o que falta é documento hábil que o comprove. "Pago sem nota" aqui
 * é a verdade, e é para isso que o alarme serve (adendo §5.2(ii)).
 */
export const DESFECHO_FICA_NA_ORIGEM =
  "Então foi ligado ao papel errado. O vínculo se desfaz, com registro, e ele " +
  'volta a "pago sem nota" na obra de origem. O pagamento continua sendo ' +
  "dispêndio dela — o que falta é o documento hábil que o comprove.";

/**
 * O resumo do desfecho MISTO — o único lugar em que a tela narra a mistura.
 *
 * ⚠️ A frase *"o total não muda"* está **proibida** como afirmação geral
 * (adendo §5.2): ela só vale quando **todos** os pagamentos acompanham a nota.
 * Em desfecho misto o custo comprovado somado das duas obras **cai
 * legitimamente** — a diferença é o pagamento que ficou sem documento hábil.
 *
 * ⚠️ **TEXTO REDIGIDO PELO `contador` NO GATE 2 (bloqueante 1), e a correção
 * não é de estilo: a versão anterior afirmava número FALSO, e errava sempre
 * para MAIS.** Ela derivava a queda da PARTIÇÃO DOS PAGAMENTOS (`{fica}`),
 * quando a queda vem da ALOCAÇÃO. Os dois só coincidem quando
 * Σ pagamentos ≤ valor da nota. Exemplo do parecer: nota 9.400, PIX 6.000
 * (junto), boleto 6.000 (fica) — a tela dizia que caía 6.000, e cai 3.400.
 * Superestimar a queda é inflar o alarme sobre o número da meta 1, que é
 * justamente o número pelo qual ele decide se pode pagar alguém. E um
 * pagamento que fica e que também comprova OUTRA nota da origem não volta a
 * "pago sem nota" — mas entrava em `{fica}`, de modo que a primeira frase
 * também mentia.
 *
 * **Todos os números saem da MESMA alocação que alimenta as duas tabelas da
 * tela** (`origemAntes/origemDepois/destinoAntes/destinoDepois`), nunca da soma
 * dos pagamentos escolhidos:
 * - `semNotaSobeCentavos` = Σ anos [`semNotaDoAno(origemDepois) −
 *   semNotaDoAno(origemAntes)`];
 * - `quedaCentavos` = Σ [`antes − depois`] das entradas de anos afetados, das
 *   DUAS obras.
 *
 * `{total}`, `{junto}` e `{fica}` continuam sendo a partição dos pagamentos —
 * é o que a primeira frase descreve, e ali ela é verdadeira: são os
 * pagamentos que acompanham a nota e os que continuam na origem.
 */
export function resumoDesfechoMisto(entrada: {
  totalCentavos: number;
  juntoCentavos: number;
  ficaCentavos: number;
  /** Da alocação, nunca da soma dos pagamentos que ficaram. */
  semNotaSobeCentavos: number;
  /** Da alocação, somando as duas obras. */
  quedaCentavos: number;
  obraOrigemNome: string;
  formatar: (centavos: number) => string;
}): string {
  const { formatar, obraOrigemNome: origem } = entrada;

  const primeira =
    `Dos ${formatar(entrada.totalCentavos)} ligados a esta nota, ` +
    `${formatar(entrada.juntoCentavos)} acompanham a nota e ` +
    `${formatar(entrada.ficaCentavos)} continuam em ${origem}.`;

  // Variação obrigatória 1: "sobe R$ 0,00" é o mesmo defeito com outro sinal —
  // a oração inteira sai.
  const subida =
    entrada.semNotaSobeCentavos > 0
      ? `o "pago sem nota" de ${origem} sobe ${formatar(entrada.semNotaSobeCentavos)}, e `
      : "";

  // Variação obrigatória 2: queda zero não se anuncia como queda.
  //
  // O `else` cobre também o caso aritmeticamente improvável de a soma SUBIR:
  // "não muda" seria impreciso ali, mas nunca falso na direção perigosa —
  // afirmar uma queda que não houve é que seria (parecer §4: superestimar
  // custo é a direção que gera passivo).
  const efeito =
    entrada.quedaCentavos > 0
      ? `o custo confirmado, somando as duas obras, cai ${formatar(entrada.quedaCentavos)}.`
      : "o custo confirmado, somando as duas obras, não muda — esta nota já " +
        "não comprovava esse valor.";

  return (
    `${primeira} Depois desta correção, ${subida}${efeito} Isso não é perda: ` +
    `esse dinheiro continua sendo dispêndio de ${origem} — o que falta é o ` +
    "documento hábil que o comprove."
  );
}


/**
 * Critério 4 / parecer §6.3 — copiado literalmente, e é o mesmo texto na
 * correção de valor e no move. **Construir uma vez**: saindo duas vezes, o
 * Mateus veria dois avisos diferentes para o mesmo evento fiscal.
 */
export const AVISO_ANO_ANTERIOR =
  "Esta correção mudou o custo de um ano anterior; se a DAA daquele ano já " +
  "foi entregue, avalie retificadora com seu contador.";

/**
 * A fronteira do §6 e do adendo §5.3, dita como o app pode provar. O app
 * **não sabe** qual ano foi declarado — inferir por calendário erra de janeiro
 * a abril, que é a janela em que ele mais mexe no acervo.
 */
export const SO_SEI_QUE_E_ANO_ANTERIOR =
  "O app não sabe se você já entregou a declaração daquele ano. Ele sabe que " +
  "é um ano anterior ao corrente, e é só isso que ele afirma. Quem sabe a " +
  "data da entrega é você.";

/** Adendo §5 — por que esta tela não pergunta motivo. */
export const MOVE_NAO_PERGUNTA_MOTIVO =
  "Esta tela não pergunta o motivo: o papel não tem obra. Obra é arquivamento " +
  "do app, e “o emitente corrigiu a nota” é impossível num campo que não " +
  "existe no documento. O registro grava sozinho o motivo " +
  "arquivamento_corrigido — não “arquivado na obra errada”, que seria o app " +
  "inferindo a causa. Rastro registra fato.";

/** Critério 13 — a recusa do estado que o critério 11 do CONTAI-018 proíbe. */
export const SEM_TERCEIRA_SAIDA =
  "Não existe uma terceira saída. Deixar o vínculo cruzando duas obras é o " +
  "estado que o critério 11 proíbe pela porta da frente — ele fica invisível " +
  "nas duas telas, derruba o custo de uma obra sem levantar o da outra, e " +
  "acende “pago sem nota” por um fato que não aconteceu.";

/**
 * O pagamento que comprova MAIS DE UM documento não pode acompanhar a nota:
 * levá-lo deixaria o OUTRO vínculo cruzando duas obras — o mesmo estado
 * inválido, com os papéis trocados. Recusa com o motivo na tela, nunca em
 * silêncio (mesma disciplina de `MOTIVO_OBRA_DIFERENTE`).
 *
 * A guarda também existe dentro de `mover_documento_de_obra` (migration 0009):
 * a tela explica, o banco recusa.
 */
export const PAGAMENTO_LIGADO_A_OUTRA_NOTA =
  "Este pagamento também comprova outra nota desta obra. Levá-lo junto " +
  "deixaria aquele vínculo cruzando duas obras — o mesmo estado que esta " +
  "correção existe para desfazer. Desligue-o da outra nota antes, ou deixe-o " +
  "na obra de origem.";

// ── Desfecho por pagamento (critério 13) ─────────────────────────────────

/** Os dois desfechos do adendo §5.2. Não existe um terceiro. */
export type DesfechoDoPagamento = "vai_junto" | "fica_na_origem";

export interface EscolhaDePagamento {
  pagamentoId: string;
  desfecho: DesfechoDoPagamento;
}

/**
 * Os pagamentos vinculados a este documento que **não podem** acompanhar a
 * nota, com o motivo. Lista vazia é o caso normal.
 */
export function pagamentosImpedidosDeIrJunto(
  documento: Pick<Documento, "id">,
  pagamentos: readonly Pagamento[],
): Pagamento[] {
  return pagamentos.filter(
    (p) =>
      p.documentoIds.includes(documento.id) &&
      p.documentoIds.some((id) => id !== documento.id),
  );
}

/** Os pagamentos que hoje comprovam esta nota — os que a tela pergunta. */
export function pagamentosVinculados(
  documento: Pick<Documento, "id">,
  pagamentos: readonly Pagamento[],
): Pagamento[] {
  return pagamentos.filter((p) => p.documentoIds.includes(documento.id));
}

// ── Simulação do move, sobre cópia (nunca sobre o painel real) ───────────

export interface PainelDeObra {
  obraId: string;
  documentos: readonly Documento[];
  pagamentos: readonly Pagamento[];
}

export interface MoveSimulado {
  origemAntes: EntradaAlocacao;
  origemDepois: EntradaAlocacao;
  destinoAntes: EntradaAlocacao;
  destinoDepois: EntradaAlocacao;
}

/**
 * O estado das DUAS obras depois do ato, sem tocar em nada.
 *
 * O que o move de verdade faz, e o que esta cópia reproduz:
 * - o documento sai da origem e entra no destino;
 * - cada pagamento `vai_junto` sai da origem e entra no destino **com o
 *   vínculo intacto** — é o único desfecho que transfere custo (§5.2(i));
 * - cada pagamento `fica_na_origem` continua na origem **sem o vínculo**, e
 *   volta a "pago sem nota" ali (§5.2(ii)).
 */
export function simularMoveDeObra(entrada: {
  documento: Documento;
  origem: PainelDeObra;
  destino: PainelDeObra;
  escolhas: readonly EscolhaDePagamento[];
}): MoveSimulado {
  const { documento, origem, destino } = entrada;
  const vaoJunto = new Set(
    entrada.escolhas
      .filter((e) => e.desfecho === "vai_junto")
      .map((e) => e.pagamentoId),
  );

  const documentoNoDestino: Documento = { ...documento, obraId: destino.obraId };

  const origemDepois: EntradaAlocacao = {
    documentos: origem.documentos.filter((d) => d.id !== documento.id),
    pagamentos: origem.pagamentos
      .filter((p) => !vaoJunto.has(p.id))
      .map((p) =>
        p.documentoIds.includes(documento.id)
          ? { ...p, documentoIds: p.documentoIds.filter((id) => id !== documento.id) }
          : p,
      ),
  };

  const destinoDepois: EntradaAlocacao = {
    documentos: [...destino.documentos, documentoNoDestino],
    pagamentos: [
      ...destino.pagamentos,
      ...origem.pagamentos
        .filter((p) => vaoJunto.has(p.id))
        .map((p) => ({ ...p, obraId: destino.obraId })),
    ],
  };

  return {
    origemAntes: { documentos: origem.documentos, pagamentos: origem.pagamentos },
    origemDepois,
    destinoAntes: { documentos: destino.documentos, pagamentos: destino.pagamentos },
    destinoDepois,
  };
}

// ── O detector, construído UMA vez (parecer §6, relação com a D-018.2) ───

export interface ComparacaoDeObra {
  obraId: string;
  antes: Alocacao;
  depois: Alocacao;
}

/**
 * Os anos-calendário cujo custo comprovado mudou, **por obra**.
 *
 * ⚠️ SÓ ENTRA O QUE MUDOU. É o filtro do critério 20(c): as obras
 * **candidatas** são `antes ∪ depois` do campo `obra` (quem as monta é a tela,
 * passando as duas comparações); **afetada é a candidata cujo custo daquele ano
 * efetivamente mudou**. Sem ele, o desfecho em que TODOS os pagamentos ficam na
 * origem acenderia pendência numa obra onde nenhum número se mexeu —
 * contradizendo o §5.3 na frase seguinte a ela, e alarme falso é a doença que
 * este ticket existe para curar.
 *
 * `pendencia` é verdadeiro só em ano ANTERIOR ao corrente (§5.3): delta só no
 * ano corrente não abre nada, porque o número se corrige sozinho antes da DAA.
 * `anoCorrente` vem por parâmetro — "hoje" nunca é lido aqui dentro.
 */
export function anosAfetados(
  comparacoes: readonly ComparacaoDeObra[],
  anoCorrente: number,
): AnoAfetado[] {
  const afetados: AnoAfetado[] = [];

  for (const c of comparacoes) {
    const anos = new Set<number>();
    for (const a of c.antes.porPagamento.values()) {
      anos.add(anoCalendario(a.pagamento.dataPagamento));
    }
    for (const a of c.depois.porPagamento.values()) {
      anos.add(anoCalendario(a.pagamento.dataPagamento));
    }

    for (const ano of [...anos].sort((x, y) => x - y)) {
      const antes = custoComprovadoDoAno(c.antes, ano);
      const depois = custoComprovadoDoAno(c.depois, ano);
      if (antes === depois) continue;
      afetados.push({
        obraId: c.obraId,
        ano,
        antesCentavos: antes,
        depoisCentavos: depois,
        pendencia: ano < anoCorrente,
      });
    }
  }

  return afetados;
}

/** Atalho para a correção que mexe numa obra só (valor, classificação). */
export function anosAfetadosDeUmaObra(
  obraId: string,
  antes: EntradaAlocacao,
  depois: EntradaAlocacao,
  anoCorrente: number,
): AnoAfetado[] {
  return anosAfetados(
    [{ obraId, antes: alocarCusto(antes), depois: alocarCusto(depois) }],
    anoCorrente,
  );
}

/**
 * A fronteira do §5.3, em uma linha: **pendência persistente só nasce quando a
 * correção muda um NÚMERO que foi ou será declarado.**
 *
 * As três linhas da tabela do parecer caem todas aqui:
 * - **sem** pagamento vinculado → nenhum ano mudou (documento sozinho comprova
 *   zero dos dois lados) → `false`;
 * - **com** pagamento vinculado e delta em ano ANTERIOR → `true`;
 * - **com** pagamento vinculado e delta só no ano CORRENTE → `false`.
 */
export function abrePendencia(anos: readonly AnoAfetado[]): boolean {
  return anos.some((a) => a.pendencia);
}

/** Os anos que vão virar (ou acumular em) pendência, sem repetição. */
export function anosComPendencia(anos: readonly AnoAfetado[]): number[] {
  return [...new Set(anos.filter((a) => a.pendencia).map((a) => a.ano))].sort(
    (x, y) => x - y,
  );
}

// ── Leitura do rastro (critério 16) ──────────────────────────────────────

/**
 * Um ATO, como a tela o mostra: uma linha, com as N linhas granulares do banco
 * dentro (critério 13 — "no banco elas são granulares, na tela são uma
 * correção só"). Um move de documento com 2 pagamentos é UM ato e TRÊS
 * `Revisao`.
 */
export interface AtoDeCorrecao {
  atoId: string;
  quando: string;
  motivo: MotivoRevisao;
  motivoTexto: string | null;
  linhas: Revisao[];
  anosAfetados: AnoAfetado[];
}

/**
 * Agrupa as linhas por `ato_id`, do mais recente para o mais antigo.
 *
 * A ordem dentro do ato é preservada como veio do banco (documento primeiro,
 * pagamentos depois): é a ordem em que a função os gravou, e é a que faz a
 * linha do histórico ler como a frase "movido de A para B, com 2 pagamentos".
 */
export function agruparPorAto(revisoes: readonly Revisao[]): AtoDeCorrecao[] {
  const porAto = new Map<string, AtoDeCorrecao>();

  for (const r of revisoes) {
    const atual = porAto.get(r.atoId);
    if (atual) {
      atual.linhas.push(r);
      atual.anosAfetados.push(...r.anosAfetados);
      // O ato tem um instante só; o menor é o da primeira linha gravada.
      if (r.quando < atual.quando) atual.quando = r.quando;
      continue;
    }
    porAto.set(r.atoId, {
      atoId: r.atoId,
      quando: r.quando,
      motivo: r.motivo,
      motivoTexto: r.motivoTexto,
      linhas: [r],
      anosAfetados: [...r.anosAfetados],
    });
  }

  return [...porAto.values()].sort((a, b) => (a.quando < b.quando ? 1 : -1));
}

/**
 * "Pago sem nota" do ano, lido da MESMA alocação que produz o número da home.
 *
 * Existe aqui, e não em `lib/fiscal/vinculo.ts`, porque aquele arquivo não
 * ganha regra nova neste ticket (viabilidade do `cto-obra` + ressalva 6 do
 * `contador`). Isto não é regra: é leitura de `porPagamento`, exatamente como
 * `custoComprovadoDoAno` — e é o segundo número que a tela do move precisa
 * mostrar, porque é ele que sobe na origem quando o vínculo se desfaz e é ele
 * que o Mateus usa para decidir se pode pagar alguém (meta 1).
 */
export function semNotaDoAno(alocacao: Alocacao, ano: number): number {
  let total = 0;
  for (const a of alocacao.porPagamento.values()) {
    if (anoCalendario(a.pagamento.dataPagamento) === ano) {
      total += a.semNotaCentavos;
    }
  }
  return total;
}

/** Os anos que aparecem numa alocação, crescentes. Serve à tabela da tela. */
export function anosDaAlocacao(...alocacoes: readonly Alocacao[]): number[] {
  const anos = new Set<number>();
  for (const alocacao of alocacoes) {
    for (const a of alocacao.porPagamento.values()) {
      anos.add(anoCalendario(a.pagamento.dataPagamento));
    }
  }
  return [...anos].sort((x, y) => x - y);
}

// ── Composição da discriminação (critério 5) ─────────────────────────────

// ⚠️ **DUAS composições moram neste arquivo, e elas NÃO usam a mesma regra.**
// Ficam lado a lado de propósito: separá-las é como a defeituosa sobreviveria
// sem ninguém notar. Leia as duas antes de mexer em qualquer uma.
//
// - `composicaoDaDiscriminacao` — a antiga (CONTAI-021), sem recorte de ano,
//   ponderada por `cobertoCentavos`. ⛔ O parecer de 24/08 §0 a nomeia como
//   **defeito vivo**. Não foi corrigida aqui: corrigi-la muda o número de uma
//   tela já entregue, o que é escopo do `po`, não do CONTAI-036.
// - `composicaoDoAno` — a nova, do parecer
//   `docs/pareceres/2026-08-24-composicao-material-mao-de-obra.md` §1, com
//   recorte de ano e ponderada pelo **valor integral** dos documentos hábeis.
//   É esta que a discriminação anual usa.


export interface Composicao {
  materialCentavos: number;
  maoObraCentavos: number;
  /** Documento hábil sem classificação gravada. Não se inventa uma. */
  semClassificacaoCentavos: number;
  totalCentavos: number;
}

/**
 * Quanto do custo comprovado é **material** e quanto é **mão de obra**.
 *
 * Parecer §1, linha `classificacao`: "CORRIGÍVEL sempre, sem trava. Não muda
 * total nenhum; muda a COMPOSIÇÃO (material × mão de obra) da discriminação."
 * O total é a soma — e é por isso que a tela pode afirmar que ele não muda: a
 * correção só troca de balde a parcela DAQUELE documento.
 *
 * ⚠️ DUAS PRECISÕES, e as duas são limitações declaradas, não descuido:
 *
 * 1. **Não há quebra por ano**, e o mock s4 mostra uma. O ano do custo é o da
 *    DATA DO PAGAMENTO (regime de caixa); a classificação é do DOCUMENTO. Num
 *    componente com vários documentos e pagamentos de anos diferentes, repartir
 *    o coberto de um documento entre anos exigiria uma regra de atribuição que
 *    **nenhum parecer definiu** — e inventá-la aqui seria o palpite que o
 *    ticket proíbe. Divergência registrada para o Gate 2.
 * 2. Quando um componente tem mais de um documento hábil, a repartição do
 *    coberto ENTRE eles vem de `alocarCusto`, que a declara explicitamente
 *    "sem efeito fiscal nenhum — ordem estável por id só para a tela não
 *    dançar". No agregado a soma está certa; a linha de um documento
 *    individual, nesse caso, é arbitrária-mas-estável.
 */
export function composicaoDaDiscriminacao(alocacao: Alocacao): Composicao {
  let material = 0;
  let maoObra = 0;
  let sem = 0;

  for (const a of alocacao.porDocumento.values()) {
    if (!a.habil) continue;
    if (a.documento.classificacao === "material") material += a.cobertoCentavos;
    else if (a.documento.classificacao === "mao_obra") maoObra += a.cobertoCentavos;
    else sem += a.cobertoCentavos;
  }

  return {
    materialCentavos: material,
    maoObraCentavos: maoObra,
    semClassificacaoCentavos: sem,
    totalCentavos: material + maoObra + sem,
  };
}

/**
 * A repartição do custo comprovado **do ano** entre material e mão de obra —
 * a cláusula *"sendo R$ X em materiais e R$ Y em mão de obra e serviços"* do
 * Bloco A da discriminação (CONTAI-036, critério 3).
 *
 * **Regra fiscal, com parecer próprio**:
 * `docs/pareceres/2026-08-24-composicao-material-mao-de-obra.md` §1. Não é
 * decisão de implementação e não se troca por "o que parece mais justo".
 * Literal:
 *
 *     O custo comprovado de cada pagamento (`comprovadoCentavos`) é repartido
 *     pro rata pelo valor dos documentos HÁBEIS do componente conexo a que o
 *     pagamento pertence — pelos VALORES INTEGRAIS desses documentos, NUNCA
 *     por `cobertoCentavos`.
 *
 * ⚠️ **Por que nunca `cobertoCentavos`** (§0 do parecer — defeito vivo, não
 * hipótese): `cobertoCentavos` é distribuído em `alocarCusto` por **ordem de
 * `id`**, que o próprio `vinculo.ts` declara *"sem efeito fiscal nenhum"*. Num
 * componente subcoberto essa ordem decidiria, por id, se o que está coberto é
 * a nota de material ou a de serviço.
 *
 * ⚠️ **Não é o pro-rata recusado no ADENDO de 18/08** (§2.3): aquele movia
 * custo **entre anos** e contradiria DAA entregue; este **não toca o total do
 * ano** — `custoComprovadoDoAno` continua intocado e cronológico.
 *
 * ⚠️ **Alternativa recusada** (§2.1): repartir pela classificação dos
 * documentos ligados a **cada pagamento** não é função total — a repartição
 * cronológica pode dar `comprovadoCentavos > 0` a um pagamento ligado só a
 * documento **não hábil** (boleto, quarentena), e ali a regra não responde.
 *
 * `material + maoObra + semClassificacao ≡ total`, ao centavo (§3): maior
 * resto, resíduo fixo em **mão de obra e serviços**. A palavra *"sendo"*
 * afirma uma partição; partição que não fecha se contradiz dentro da DAA.
 *
 * ⚠️ `semClassificacaoCentavos > 0` **SUSPENDE a cláusula** (§4) — quem gera o
 * texto não escolhe um balde. Ver `discriminacao.ts`.
 */
/**
 * Os componentes conexos que puseram custo comprovado **neste ano**, com
 * quanto cada um pôs.
 *
 * ⚠️ **Existe para ser o ÚNICO laço**, e a razão é do Gate 2 do CONTAI-036:
 * `composicaoDoAno` suspende a cláusula por componente, com valor **integral**
 * e centavo **no ano**; a contagem de notas que a tela exibe estava sendo
 * tirada de uma varredura **separada** do acervo inteiro, por
 * `cobertoCentavos > 0`. Dois números do mesmo fato, por dois caminhos —
 * e as duas maneiras de errar apareceram:
 *
 * 1. **"0 notas … compõem o total"** — nota sem classificação cujo
 *    `cobertoCentavos` é zero suspendia a cláusula e não era contada;
 * 2. **nota contada sem ter posto centavo no ano** — componente cujos
 *    pagamentos caem todos em outro ano entrava na contagem.
 *
 * Quem consome a suspensão e quem a explica leem o mesmo laço, ou voltam a
 * divergir na primeira mudança.
 */
function componentesDoAno(
  alocacao: Alocacao,
  ano: number,
): { documentos: readonly Documento[]; doAno: number }[] {
  const doAno: { documentos: readonly Documento[]; doAno: number }[] = [];
  for (const c of alocacao.componentes) {
    let total = 0;
    for (const p of c.pagamentos) {
      if (anoCalendario(p.dataPagamento) !== ano) continue;
      total += alocacao.porPagamento.get(p.id)?.comprovadoCentavos ?? 0;
    }
    // Componente que não contribui com centavo nenhum aqui é ignorado —
    // inclusive para a suspensão do §4.1: "alarme sem consequência ensina a
    // ignorar alarme".
    if (total === 0) continue;
    doAno.push({ documentos: c.documentos, doAno: total });
  }
  return doAno;
}

/**
 * As notas hábeis **sem classificação** que compõem o total do ano — as que
 * suspendem a cláusula (parecer de 24/08 §4), e as mesmas que o texto da
 * suspensão conta.
 *
 * ⚠️ Sai do **mesmo laço** de `composicaoDoAno`, e é isso que garante que a
 * frase *"N notas que compõem o total de {ano}"* nunca discorde da suspensão
 * que ela explica. Nunca uma varredura do acervo inteiro.
 */
export function notasSemClassificacaoDoAno(
  alocacao: Alocacao,
  ano: number,
): Documento[] {
  const vistas = new Map<string, Documento>();
  for (const c of componentesDoAno(alocacao, ano)) {
    for (const d of c.documentos) {
      if (!ehDocumentoHabil(d) || d.classificacao !== null) continue;
      vistas.set(d.id, d);
    }
  }
  return [...vistas.values()];
}

export function composicaoDoAno(alocacao: Alocacao, ano: number): Composicao {
  // ⚠️ `BigInt(0)` e não `0n`: o `target` do projeto é ES2017 e literal de
  // BigInt só existe de ES2020 em diante. O tipo inteiro é necessário — o
  // produto `total × numerador` estoura `Number.MAX_SAFE_INTEGER` bem dentro
  // da ordem de grandeza desta obra, e um centavo perdido aqui quebra a
  // identidade `X + Y ≡ total` que o §3 do parecer torna inegociável.
  const ZERO = BigInt(0);
  const UM = BigInt(1);

  let material = 0;
  let maoObra = 0;
  let sem = 0;

  for (const { documentos, doAno } of componentesDoAno(alocacao, ano)) {
    // Denominador: o conjunto de notas HÁBEIS do componente, pelos valores
    // INTEGRAIS. A proporção é do conjunto, e por isso é uniforme entre todos
    // os pagamentos dele, caiam no ano que caírem (§1).
    let dMaoObra = ZERO;
    let dMaterial = ZERO;
    let dSem = ZERO;
    for (const d of documentos) {
      if (!ehDocumentoHabil(d)) continue;
      const v = BigInt(d.valorCentavos ?? 0);
      if (d.classificacao === "material") dMaterial += v;
      else if (d.classificacao === "mao_obra") dMaoObra += v;
      else dSem += v;
    }
    const denominador = dMaoObra + dMaterial + dSem;
    if (denominador === ZERO) {
      // Inalcançável pela álgebra de `alocarCusto` (sem nota hábil o custo
      // comprovado do componente é zero) — e tratado assim mesmo, na direção
      // que SUSPENDE a cláusula. Nunca na que inventa um balde.
      sem += doAno;
      continue;
    }

    // Maior resto, em inteiro — `doAno * n / D` sem ponto flutuante. Ordem de
    // desempate FIXA, mão de obra primeiro (§3), para o número não dançar
    // entre dois carregamentos.
    const total = BigInt(doAno);
    const baldes = [dMaoObra, dMaterial, dSem].map((numerador) => {
      const produto = total * numerador;
      const base = produto / denominador;
      return { base, resto: produto - base * denominador };
    });
    let sobra = total - baldes.reduce((acc, b) => acc + b.base, ZERO);
    for (const b of [...baldes].sort((x, y) =>
      x.resto === y.resto ? 0 : x.resto > y.resto ? -1 : 1,
    )) {
      if (sobra === ZERO) break;
      b.base += UM;
      sobra -= UM;
    }
    maoObra += Number(baldes[0].base);
    material += Number(baldes[1].base);
    sem += Number(baldes[2].base);
  }

  return {
    materialCentavos: material,
    maoObraCentavos: maoObra,
    semClassificacaoCentavos: sem,
    totalCentavos: material + maoObra + sem,
  };
}

/**
 * Adendo §2 — **cópia literal**. Marcenaria fixa **não é uma terceira opção**
 * desta lista e **não dispara alarme** ao escolher "Material": ela é dúvida de
 * *dentro ou fora do custo de aquisição*, outra pergunta, que nenhuma das duas
 * opções desta tela expressa. Alarme que dispara em quase todo caso que não é
 * marcenaria é alarme que não desliga. Fica como rodapé passivo.
 */
export const RODAPE_MARCENARIA =
  "Esta escolha muda só a composição do que você declara (material × mão de " +
  "obra). Não muda o total e não tira nada do custo. Se a sua dúvida é se o " +
  "gasto entra no custo do imóvel — é o caso de marcenaria fixa e planejados " +
  "—, isso não se decide aqui: leve ao seu contador.";

/**
 * Adendo §3 — **cópia literal, e a segunda linha é obrigatória**. Todo ato que
 * altere a identificação de um favorecido já gravado exige, no mesmo ato,
 * afirmação explícita de que o CNPJ/CPF gravado é o impresso no anexo. É o
 * único instante em que o CNPJ gravado é lido lado a lado com o papel.
 */
export function afirmacaoDoCnpj(documentoFormatado: string): string {
  return `O CNPJ impresso na nota é ${documentoFormatado} — só o nome está diferente.`;
}

export const AFIRMACAO_CNPJ_SEGUNDA_LINHA =
  "Não é esse o CNPJ do papel? Então não é o nome que está errado.";

/**
 * Adendo §4 — **cópia literal**. Nome corrigido com pagamento em ano anterior
 * gera **aviso + rastro, e não abre pendência**: o custo não muda um centavo, e
 * a ficha Pagamentos Efetuados identifica o beneficiário pelo CPF/CNPJ — o nome
 * acompanha.
 */
export function avisoNomeEmAnoAnterior(ano: number): string {
  return (
    `Um dos pagamentos deste favorecido é de ${ano}. Se você já entregou a ` +
    "declaração daquele ano, o nome que saiu nela continua diferente do que o " +
    "app mostra a partir de agora. O CPF/CNPJ, que é o que identifica o " +
    "favorecido na declaração, não mudou."
  );
}

export const AVISO_NOME_FICA_NO_HISTORICO =
  "Esta correção fica registrada no histórico, com a data. Se o seu contador " +
  "precisar dela, está lá — o app não decide se isso pede retificadora.";

// ── O ciclo da pendência de retificadora (critérios 20 e 21) ─────────────

/**
 * Uma pendência de ANO, montada para a tela.
 *
 * ⚠️ A chave é o ANO, e nunca a correção: "cinco correções em 2025 são UMA
 * linha na lista. Alarme que se multiplica é o mesmo defeito do alarme que não
 * desliga, com outro sinal" (critério 20a). E nunca a OBRA: "a DAA é do
 * contribuinte, não da obra — uma retificadora de 2025 corrige as linhas das
 * duas obras no mesmo ato, e o desfecho não é divisível" (adendo §5.4).
 */
export interface PendenciaDeAno {
  id: string;
  ano: number;
  abertaEm: string;
  /** A mais recente das correções que a compõem. */
  ultimaCorrecaoEm: string;
  /** ATOS, não linhas de banco: um move com 2 pagamentos conta 1. */
  quantidadeDeAtos: number;
  /**
   * As obras AFETADAS, cada uma com o SEU delta — nunca somadas.
   * Vêm do RASTRO (`antes ∪ depois` do campo `obra`), nunca de
   * `documento.obra_id`: depois do move o documento só conhece o DESTINO, e
   * derivar dele apagaria a ORIGEM, que é o lado onde o custo caiu.
   */
  obras: {
    obraId: string;
    /** O acumulado do ano: PRIMEIRO `antes` → ÚLTIMO `depois`. */
    antesCentavos: number;
    depoisCentavos: number;
  }[];
  /** `null` = aberta. Preenchido = baixada, e a baixa é acréscimo. */
  desfecho: PendenciaPersistente["desfecho"];
}

export interface LinhaDeAnoDaPendencia {
  pendenciaId: string;
  revisaoId: string;
  ano: AnoAfetado;
}

/**
 * Junta pendência + snapshot + rastro no que a tela mostra.
 *
 * O ACUMULADO é "do primeiro `antes` — como estava antes da primeira correção
 * — ao último `depois`" (critério 20a). Não é a soma dos deltas e não é o
 * delta da última correção: "é esse número que interessa a quem for avaliar a
 * retificadora, não o delta de cada correção isolada".
 */
export function montarPendenciasDeAno(entrada: {
  pendencias: readonly PendenciaPersistente[];
  linhas: readonly LinhaDeAnoDaPendencia[];
  revisoes: readonly Revisao[];
}): PendenciaDeAno[] {
  const quandoDaRevisao = new Map(entrada.revisoes.map((r) => [r.id, r.quando]));
  const atoDaRevisao = new Map(entrada.revisoes.map((r) => [r.id, r.atoId]));

  return entrada.pendencias
    .filter((p) => p.tipo === "retificadora_possivel" && p.ano !== null)
    .map((p) => {
      const minhas = entrada.linhas
        .filter((l) => l.pendenciaId === p.id)
        .sort((a, b) => {
          const qa = quandoDaRevisao.get(a.revisaoId) ?? "";
          const qb = quandoDaRevisao.get(b.revisaoId) ?? "";
          return qa < qb ? -1 : qa > qb ? 1 : 0;
        });

      const porObra = new Map<string, { antes: number; depois: number }>();
      for (const l of minhas) {
        const atual = porObra.get(l.ano.obraId);
        if (atual) {
          // Só o DEPOIS avança: o ANTES é o da primeira correção do ano.
          atual.depois = l.ano.depoisCentavos;
        } else {
          porObra.set(l.ano.obraId, {
            antes: l.ano.antesCentavos,
            depois: l.ano.depoisCentavos,
          });
        }
      }

      const quandos = minhas
        .map((l) => quandoDaRevisao.get(l.revisaoId) ?? p.abertaEm)
        .sort();

      return {
        id: p.id,
        ano: p.ano as number,
        abertaEm: p.abertaEm,
        ultimaCorrecaoEm: quandos[quandos.length - 1] ?? p.abertaEm,
        quantidadeDeAtos: new Set(
          minhas.map((l) => atoDaRevisao.get(l.revisaoId) ?? l.revisaoId),
        ).size,
        obras: [...porObra.entries()].map(([obraId, v]) => ({
          obraId,
          antesCentavos: v.antes,
          depoisCentavos: v.depois,
        })),
        desfecho: p.desfecho,
      };
    })
    .sort((a, b) => b.ano - a.ano);
}

/** As pendências ABERTAS que atingem ESTA obra — o que a home dela mostra. */
export function pendenciasAbertasDaObra(
  pendencias: readonly PendenciaDeAno[],
  obraId: string,
): PendenciaDeAno[] {
  return pendencias.filter(
    (p) => p.desfecho === null && p.obras.some((o) => o.obraId === obraId),
  );
}

/**
 * Os três desfechos do critério 21, na ordem da tela. **Nada nasce marcado, e
 * o app não sugere nenhum**: ele não sabe se a DAA foi entregue nem o que o
 * contador respondeu, que são exatamente as duas coisas que os três separam.
 */
export const DESFECHOS_DE_RETIFICADORA = [
  {
    valor: "retifiquei_a_daa",
    titulo: (ano: number) => `Retifiquei a DAA de ${ano}`,
    detalhe:
      "A declaração já tinha sido entregue e você entregou a retificadora.",
    pedeData: true,
  },
  {
    valor: "contador_avaliou_nao_retifica",
    titulo: () => "Meu contador avaliou e não é preciso retificar",
    detalhe:
      "Você levou a diferença ao contador e a resposta foi que não retifica.",
    pedeData: true,
  },
  {
    valor: "daa_ainda_nao_entregue",
    titulo: (ano: number) => `A DAA de ${ano} ainda não foi entregue`,
    detalhe: "Não é retificadora: a correção entra na declaração normal.",
    pedeData: false,
  },
] as const;

/**
 * O desfecho manual da pendência de CNPJ errado — **um só, hoje** (critério
 * 19). A lista é PRÓPRIA: os três acima são todos sobre DAA, e nenhum descreve
 * "resolvi o CNPJ errado".
 *
 * ⚠️ O que NÃO está aqui, e é de propósito: *"já não é mais um problema, o
 * registro aponta para o favorecido certo"*. Afirmação manual do que a máquina
 * prova é carimbo que não prova nada — e na rodada 1 nada pode ter repontado,
 * então a opção só serviria para silenciar o alarme sem o conserto.
 */
export const DESFECHO_MANUAL_EMITENTE_ERRADO = {
  valor: "cnpj_gravado_esta_certo",
  titulo: "Conferi o papel: o CNPJ gravado está certo — o erro foi meu ao marcar",
  detalhe: "Único desfecho manual disponível hoje. Pede a data.",
  pedeData: true,
} as const;

/**
 * Critério 19 — a pendência que declara o que está esperando. Pendência que
 * declara a própria saída não é o defeito do critério 20; alarme MUDO é.
 */
export const EMITENTE_ERRADO_O_QUE_FALTA =
  "Enquanto não for tratado, esse documento continua apontando para um " +
  "favorecido que não é o que emitiu a nota — e é esse favorecido que sairia " +
  "na ficha Pagamentos Efetuados. A correção do apontamento ainda não existe " +
  "no app.";
