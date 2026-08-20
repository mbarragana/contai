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
  Revisao,
} from "@/lib/types";

import { anoCalendario } from "./pagamento";
import {
  alocarCusto,
  custoComprovadoDoAno,
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
 * ⚠️ Os três valores são a PARTIÇÃO dos pagamentos vinculados
 * (`total = junto + fica`), que é a única leitura em que a primeira frase
 * fecha. A queda efetiva do custo somado é mostrada NA TABELA logo acima, obra
 * por obra e ano por ano — e ela coincide com `fica` no caso canônico do
 * parecer (nota que cobre os pagamentos por inteiro), mas não em todo caso.
 * Divergência registrada para o Gate 2; a tela nunca mostra só a frase.
 */
export function resumoDesfechoMisto(entrada: {
  totalCentavos: number;
  juntoCentavos: number;
  ficaCentavos: number;
  obraOrigemNome: string;
  formatar: (centavos: number) => string;
}): string {
  const { formatar } = entrada;
  const fica = formatar(entrada.ficaCentavos);
  return (
    `Dos ${formatar(entrada.totalCentavos)}, ` +
    `${formatar(entrada.juntoCentavos)} acompanham a nota e ${fica} voltam a ` +
    `"pago sem nota" em ${entrada.obraOrigemNome}. O custo confirmado somado ` +
    `das duas obras cai ${fica}. Isso não é perda: esses ${fica} continuam ` +
    `sendo dispêndio de ${entrada.obraOrigemNome} — o que falta é o documento ` +
    "hábil que os comprove."
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
