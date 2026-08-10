/**
 * Regras da obra: prazo do CNO, custo do terreno, escolha da obra ativa e a
 * revalidação de CNO na correção de obra de um registro (CONTAI-003).
 * Módulo puro: nada de rede, nada de UI, nada de `Date.now()` — a data de
 * hoje entra por parâmetro para o teste não depender do dia em que roda.
 *
 * Fonte das regras — nada aqui é inferido:
 * - Parecer do contador de 2026-08-09 (`docs/pareceres/2026-08-09-obra-sem-cno.md`)
 *   e o adendo de 2026-08-10 que fixou como se conta o atraso.
 * - Gate Fiscal do CONTAI-003 (critérios 3, 4, 6, 10, 11, 13 e 15).
 *
 * Os textos de tela com consequência fiscal são CÓPIA do parecer. Quem for
 * mexer neles: passe pelo `contador`, não reescreva aqui.
 */

import type { Obra, TipoDocumento } from "@/lib/types";
import { ehDataValida } from "./pagamento";

// ── Datas (aritmética em UTC, para o fuso não mexer no dia) ──────────────

const MS_POR_DIA = 86_400_000;

function paraUtc(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

/** Dias corridos de `inicio` até `fim` (negativo se `fim` for antes). */
export function diasEntre(inicio: string, fim: string): number {
  return Math.round((paraUtc(fim) - paraUtc(inicio)) / MS_POR_DIA);
}

export function somarDias(iso: string, dias: number): string {
  return new Date(paraUtc(iso) + dias * MS_POR_DIA).toISOString().slice(0, 10);
}

/** yyyy-mm-dd → dd/mm/aaaa. Data em tela é sempre no formato do Mateus. */
export function formatarDataBR(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

// ── Prazo do CNO ─────────────────────────────────────────────────────────

/**
 * 30 dias corridos contados do início da obra — Lei 8.212/91, art. 49, II.
 * A dispensa do art. 30, VIII não se aplica: há mão de obra remunerada.
 */
export const PRAZO_CNO_DIAS = 30;

export type SituacaoPrazoCno = "em_atraso" | "vence_hoje" | "no_prazo";

export interface PrazoCno {
  situacao: SituacaoPrazoCno;
  /** Data em que o prazo vence (ISO). */
  vencimento: string;
  /** Dias em atraso (`em_atraso`) ou dias que faltam (`no_prazo`). */
  dias: number;
}

/**
 * Adendo do contador de 2026-08-10, que corrigiu o mock: **atraso é contado do
 * VENCIMENTO, não do início**. Dizer "o prazo é de 30 dias" e "148 dias em
 * atraso" na mesma frase é contradição que o leitor resolve subtraindo — e um
 * número inflado numa tela fiscal contamina a confiança em todas as outras.
 * Sem prorrogação para dia útil: é texto informativo, não prazo de DARF.
 */
export function prazoCno(dataInicio: string, hoje: string): PrazoCno {
  const vencimento = somarDias(dataInicio, PRAZO_CNO_DIAS);
  const dias = diasEntre(vencimento, hoje);
  if (dias > 0) return { situacao: "em_atraso", vencimento, dias };
  if (dias === 0) return { situacao: "vence_hoje", vencimento, dias: 0 };
  return { situacao: "no_prazo", vencimento, dias: -dias };
}

/**
 * A frase de prazo só existe quando há data de início conhecida e não futura
 * (regra do adendo): obra que ainda vai começar não tem prazo correndo.
 */
export function temPrazoCorrendo(dataInicio: string, hoje: string): boolean {
  return ehDataValida(dataInicio) && diasEntre(dataInicio, hoje) >= 0;
}

/**
 * Janela em que as notas saíram sem CNO: do início da obra até o registro do
 * CNO. É o intervalo que o CONTAI-007 usa para montar a lista de cobrança da
 * retificação da EFD-Reinf.
 */
export function janelaSemCnoDias(
  dataInicio: string,
  cnoRegistradoEm: string | null,
): number | null {
  if (!cnoRegistradoEm) return null;
  return Math.max(0, diasEntre(dataInicio, cnoRegistradoEm));
}

// ── Textos de tela com consequência fiscal (cópia do parecer) ────────────

export const TITULO_PENDENCIA_CNO = "Obra sem CNO — pendência aberta";

/** Primeiro parágrafo do texto de cadastro, por estado do prazo. */
export function fraseDoPrazoCno(dataInicio: string, hoje: string): string {
  const base =
    "O CNO é obrigatório e o prazo é de 30 dias contados do início da obra " +
    "(Lei 8.212/91, art. 49).";
  if (!temPrazoCorrendo(dataInicio, hoje)) {
    return `${base} Informe a data real de início desta obra para o app calcular o prazo.`;
  }
  const prazo = prazoCno(dataInicio, hoje);
  const comecou = `Esta obra começou em ${formatarDataBR(dataInicio)}`;
  const venceu = formatarDataBR(prazo.vencimento);
  if (prazo.situacao === "em_atraso") {
    return `${base} ${comecou} — o prazo venceu em ${venceu} e o registro está ${prazo.dias} dias em atraso.`;
  }
  if (prazo.situacao === "vence_hoje") {
    return `${base} ${comecou} — o prazo vence hoje.`;
  }
  return `${base} ${comecou} — o prazo vence em ${venceu}, faltam ${prazo.dias} dias. Registre antes da primeira nota da empreiteira.`;
}

/**
 * O bloco de consequências é IDÊNTICO nos três estados do prazo e sempre
 * visível (adendo do contador): o dano à aferição não começa no dia 31 — nota
 * de serviço emitida no dia 3 sem CNO já não abate. O prazo governa só a
 * multa, que é a menor das três consequências.
 */
export const CONSEQUENCIA_SEM_CNO_NOTAS =
  "as notas da empreiteira saem sem CNO impresso e não abatem a aferição do " +
  "INSS desta obra — esse INSS vai ser cobrado de novo na regularização;";

export const CONSEQUENCIA_SEM_CNO_AVERBACAO =
  "sem aferição fechada não sai a regularização; sem regularização a " +
  "construção não é averbada na matrícula; sem averbação o banco do comprador " +
  "não financia e o cartório não lavra.";

export const CNO_NAO_MUDA_IRPF =
  "as notas no seu CPF continuam valendo como custo de aquisição no IRPF. " +
  "Continue registrando aqui.";

export function proximoPassoCno(dataInicio: string): string {
  return (
    `registre o CNO no e-CAC informando a data real de início ` +
    `(${formatarDataBR(dataInicio)}), não a data de hoje. Declarar data ` +
    `posterior joga para fora da aferição tudo que você já pagou.`
  );
}

/** Texto de tela ao registrar NF de serviço em obra sem CNO. */
export const NF_SERVICO_SEM_CNO_TITULO = "Nota de serviço em obra sem CNO";

export const NF_SERVICO_SEM_CNO_EFEITO =
  "Esta nota não vai abater a aferição do INSS desta obra: sem CNO, a " +
  "empreiteira não tem como imprimir o CNO na nota nem informá-lo na " +
  "EFD-Reinf. O valor entra normalmente como custo de aquisição no IRPF.";

export const NF_SERVICO_SEM_CNO_ALAVANCA =
  "Enquanto ainda houver parcelas a pagar, exija da empreiteira: (a) CNO " +
  "impresso nas próximas notas e (b) reemissão ou retificação da EFD-Reinf " +
  "das notas já emitidas. Depois do último pagamento você perde a força para " +
  "pedir.";

/**
 * Rótulo do botão, não caixa de seleção: o adendo do contador de 2026-08-10
 * desfez a leitura do mock. Confirmação obrigatória a cada nota seria bloqueio
 * disfarçado (critério 15) — e sem alternativa a oferecer, viraria carimbo.
 */
export const ROTULO_SALVAR_SEM_CNO = "Salvar mesmo assim";

/** Critério 11 — aviso, nunca bloqueio. Redação literal do ticket. */
export const AVISO_EQUIPARACAO =
  "a sua situação pode ser de incorporação imobiliária; os relatórios deste " +
  "app assumem ganho de capital de pessoa física — confirme com o seu " +
  "contador antes de usá-los";

export function exigeAvisoEquiparacao(obra: {
  unidadesAutonomas: number;
  origemDesmembramentoLoteamento: boolean;
}): boolean {
  return obra.unidadesAutonomas > 1 || obra.origemDesmembramentoLoteamento;
}

// ── Custo do terreno (critério 4) ────────────────────────────────────────

/**
 * ITBI e despesas de escritura/registro integram o custo de aquisição
 * (IN SRF 84/2001, art. 17). Lançar só o preço pago ao vendedor subestimaria
 * o custo e aumentaria o ganho de capital na venda.
 */
export function custoTerrenoCentavos(obra: {
  valorTerrenoCentavos: number;
  valorItbiCentavos: number;
  valorEscrituraRegistroCentavos: number;
}): number {
  return (
    obra.valorTerrenoCentavos +
    obra.valorItbiCentavos +
    obra.valorEscrituraRegistroCentavos
  );
}

// ── Obra ativa (critério 6) ──────────────────────────────────────────────

/**
 * A obra ativa é a que a preferência do aparelho aponta — e SÓ ela.
 *
 * Sem valor confiável (primeiro uso, celular novo, storage limpo, obra
 * apagada, outro dispositivo) devolve `null`, e quem chama tem de abrir a
 * lista. Nunca a primeira, nunca a mais recente, nunca "a única": escolher em
 * silêncio é o `order by created_at limit 1` de hoje com outro nome, e o erro
 * de obra é impedimento de venda, não erro de estética.
 */
export function escolherObraAtiva<T extends { id: string }>(
  obras: readonly T[],
  preferidaId: string | null,
): T | null {
  if (!preferidaId) return null;
  return obras.find((o) => o.id === preferidaId) ?? null;
}

// ── Correção da obra de um registro já salvo (critério 13) ───────────────

export type ResultadoCorrecaoObra =
  | { permitido: true; aviso: string | null }
  | { permitido: false; motivo: string };

function cnoNormalizado(cno: string | null): string | null {
  if (!cno) return null;
  const digitos = cno.replace(/\D/g, "");
  return digitos === "" ? null : digitos;
}

/**
 * Mover uma NF de serviço de obra revalida o CNO referenciado na nota contra o
 * CNO da obra de destino: a correção não pode contrabandear uma nota para uma
 * obra cujo CNO ela não menciona — isso inflaria a base de aferição do CNO
 * errado, que é o dano que este ticket existe para evitar.
 *
 * `cnoReferenciado` é o CNO impresso na nota. O campo nasce no CONTAI-007
 * (critério 2); até lá chega sempre `null` daqui, e o caso "não sei o que a
 * nota referencia" é permitido COM aviso — barrar por desconhecimento
 * transformaria a correção em beco sem saída, que é a dor D9 voltando.
 */
export function podeCorrigirObra(entrada: {
  tipo: TipoDocumento | null;
  cnoReferenciado: string | null;
  cnoDestino: string | null;
}): ResultadoCorrecaoObra {
  if (entrada.tipo !== "nf_servico") return { permitido: true, aviso: null };

  const naNota = cnoNormalizado(entrada.cnoReferenciado);
  const noDestino = cnoNormalizado(entrada.cnoDestino);

  if (naNota === null) {
    return {
      permitido: true,
      aviso:
        "O CNO impresso nesta nota ainda não foi capturado, então não há o que " +
        "revalidar: confira na própria nota se ela menciona o CNO da obra de " +
        "destino antes de mover.",
    };
  }

  if (noDestino === null) {
    return {
      permitido: false,
      motivo:
        "Esta NF de serviço referencia um CNO e a obra de destino não tem CNO — " +
        "a nota entraria numa obra cujo CNO ela não menciona.",
    };
  }

  if (naNota !== noDestino) {
    return {
      permitido: false,
      motivo:
        "O CNO desta NF de serviço é diferente do CNO da obra de destino — mover " +
        "inflaria a base de aferição do CNO errado.",
    };
  }

  return { permitido: true, aviso: null };
}

// ── Validação do cadastro/edição de obra ─────────────────────────────────

export type RespostaCno = "sim" | "nao";

export interface EntradaObra {
  nome: string;
  municipio: string;
  matricula: string;
  cartorio: string;
  /** ISO; obrigatória com ou sem CNO. */
  dataInicioObra: string;
  temCno: RespostaCno | null;
  cno: string;
  cnoRegistradoEm: string;
  valorTerrenoCentavos: number | null;
  valorItbiCentavos: number | null;
  valorEscrituraRegistroCentavos: number | null;
  unidadesAutonomas: number | null;
  origemDesmembramentoLoteamento: boolean | null;
}

export interface ErroCampoObra {
  campo: keyof EntradaObra;
  mensagem: string;
}

export function validarObra(entrada: EntradaObra): ErroCampoObra[] {
  const erros: ErroCampoObra[] = [];

  if (entrada.nome.trim().length < 2) {
    erros.push({ campo: "nome", mensagem: "Dê um nome à obra." });
  }

  if (entrada.municipio.trim() === "") {
    erros.push({ campo: "municipio", mensagem: "Informe o município da obra." });
  }

  // Obrigatória com ou sem CNO: é ela que ancora o prazo de 30 dias e o
  // período que a aferição enxerga (exigência do contador).
  if (!ehDataValida(entrada.dataInicioObra)) {
    erros.push({
      campo: "dataInicioObra",
      mensagem: "Informe a data real de início da obra.",
    });
  }

  if (entrada.temCno === null) {
    erros.push({
      campo: "temCno",
      mensagem: "Responda se esta obra já tem CNO.",
    });
  }

  if (entrada.temCno === "sim") {
    if (entrada.cno.trim() === "") {
      erros.push({ campo: "cno", mensagem: "Informe o número do CNO." });
    }
    if (!ehDataValida(entrada.cnoRegistradoEm)) {
      erros.push({
        campo: "cnoRegistradoEm",
        mensagem: "Informe a data em que o CNO foi registrado.",
      });
    } else if (
      ehDataValida(entrada.dataInicioObra) &&
      diasEntre(entrada.dataInicioObra, entrada.cnoRegistradoEm) < 0
    ) {
      erros.push({
        campo: "cnoRegistradoEm",
        mensagem: "O CNO não pode ter sido registrado antes do início da obra.",
      });
    }
  }

  if (entrada.valorTerrenoCentavos === null) {
    erros.push({
      campo: "valorTerrenoCentavos",
      mensagem: "Informe o valor pago pelo terreno.",
    });
  }

  for (const campo of [
    "valorItbiCentavos",
    "valorEscrituraRegistroCentavos",
  ] as const) {
    // Opcionais (o ITBI costuma ser pago depois), mas texto ilegível não vira
    // zero em silêncio: um custo perdido aqui vira ganho de capital na venda.
    if (entrada[campo] === null) {
      erros.push({ campo, mensagem: "Valor não reconhecido — use 0,00 se não houve." });
    }
  }

  if (entrada.unidadesAutonomas === null || entrada.unidadesAutonomas < 1) {
    erros.push({
      campo: "unidadesAutonomas",
      mensagem: "Informe quantas unidades autônomas a matrícula tem (mínimo 1).",
    });
  }

  if (entrada.origemDesmembramentoLoteamento === null) {
    erros.push({
      campo: "origemDesmembramentoLoteamento",
      mensagem: "Responda se o terreno veio de desmembramento ou loteamento.",
    });
  }

  return erros;
}

/** Rótulo curto do CNO para lista e cabeçalho — nunca "sem CNO" sozinho. */
export function rotuloCno(obra: Pick<Obra, "cno">): string | null {
  return obra.cno ? `CNO ${obra.cno}` : null;
}
