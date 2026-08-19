/**
 * Regras do pagamento avulso — PIX feito sem nota nem boleto (US-007,
 * Relato 002). Módulo puro.
 *
 * Invariante fiscal (CLAUDE.md): o custo de aquisição segue REGIME DE CAIXA —
 * o ano-calendário sai da data do pagamento, nunca da data da nota.
 */

import type {
  MeioPagamento,
  StatusPagamento,
  TipoFavorecido,
} from "@/lib/types";
import { formatarBRL } from "@/lib/money";
import { tipoPorDocumento } from "./identificacao";

/**
 * Pagamento avulso deste ticket é sempre PIX (mock v4, tela 10).
 * Boleto tem fluxo próprio (documento).
 *
 * ⚠️ CARTÃO — a razão foi CORRIGIDA no CONTAI-019 (critério 26). O comentário
 * anterior dizia que "cartão depende da Q4"; **a Q4 fechou em 2026-08-08**
 * (`docs/backlog.md`, perguntas fechadas), e apontar para uma pergunta já
 * respondida é a mesma classe de defeito que um botão que promete o que não
 * faz. A razão verdadeira é outra e continua valendo: **falta o fluxo de
 * fatura** — dois momentos (compra e pagamento da fatura), confirmação compra
 * a compra, um pagamento por compra. Isso é o `CONTAI-022`, com tela própria.
 * Até lá o meio segue recusado na entrada (critérios 25-27, e
 * `decidirRegistro` em `lib/fiscal/compromisso.ts`).
 */
export const MEIO_PAGAMENTO_AVULSO: MeioPagamento = "pix";

/** Pago sem documento hábil vinculado — critério 3 da US-007. */
export const STATUS_PAGAMENTO_AVULSO: StatusPagamento = "aguardando_nf";

export interface RotulosPagoSemNota {
  /** Nome do documento que falta ("NF", "recibo"). */
  documento: string;
  /** Chip da pendência na home. */
  chip: string;
  /** Trecho do título — a concordância muda com o documento. */
  semVinculo: string;
  /** Consequência fiscal explícita. */
  consequencia: string;
}

const PJ: RotulosPagoSemNota = {
  documento: "NF",
  chip: "Pago sem nota",
  semVinculo: "sem NF vinculada",
  consequencia:
    "Custo não se sustenta no IR até a NF chegar. Cobre a NF antes da próxima parcela.",
};

const PF: RotulosPagoSemNota = {
  documento: "recibo",
  chip: "Pago sem recibo",
  semVinculo: "sem recibo vinculado",
  consequencia:
    "Custo não se sustenta no IR até o recibo chegar. Cobre o recibo assinado (nome, CPF e descrição do serviço) antes do próximo pagamento.",
};

const DESCONHECIDO: RotulosPagoSemNota = {
  documento: "documento hábil",
  chip: "Pago sem documento",
  semVinculo: "sem documento hábil vinculado",
  consequencia:
    "Custo não se sustenta no IR sem documento hábil. Informe o CNPJ/CPF do favorecido para saber se falta NF (PJ) ou recibo assinado (PF).",
};

/**
 * O que o pagamento sem documento está esperando depende de QUEM recebeu
 * (contador, Gate 2 do CONTAI-001):
 * - PJ → nota fiscal;
 * - PF (prestador autônomo) → recibo assinado com nome, CPF completo e
 *   descrição do serviço, junto do comprovante da transferência. PF não emite
 *   NF: cobrar "a nota" dele seria cobrar o impossível;
 * - tipo desconhecido → não dá para dizer qual dos dois, e o app não escolhe
 *   por conta própria.
 *
 * O status interno continua `aguardando_nf` (enum do banco); o que muda é o
 * que o Mateus lê.
 */
export function rotulosPagoSemNota(
  tipo: TipoFavorecido | null,
): RotulosPagoSemNota {
  if (tipo === "pj") return PJ;
  if (tipo === "pf") return PF;
  return DESCONHECIDO;
}

export interface EntradaPagamento {
  favorecidoNome: string;
  favorecidoDocumento: string;
  valorCentavos: number | null;
  /** ISO (yyyy-mm-dd). */
  dataPagamento: string | null;
  /**
   * ⚠️ **NÃO É MAIS VALIDADO** (CONTAI-019, critério 46): a ausência do
   * comprovante deixou de recusar a gravação. O campo continua na entrada
   * porque o FORMULÁRIO precisa dele para dizer, antes do toque, qual estado
   * vai nascer — e porque tirá-lo do tipo apagaria a única pista de que a
   * decisão foi deliberada. Ver a nota no fim de `validarPagamentoAvulso`.
   */
  temComprovante: boolean;
}

export interface ErroCampoPagamento {
  campo: keyof EntradaPagamento;
  mensagem: string;
}

/** Ano-calendário do custo: regime de caixa. */
export function anoCalendario(dataPagamento: string): number {
  return Number(dataPagamento.slice(0, 4));
}

export function ehDataValida(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

export function validarPagamentoAvulso(
  entrada: EntradaPagamento,
  hojeIso: string,
): ErroCampoPagamento[] {
  const erros: ErroCampoPagamento[] = [];

  if (entrada.favorecidoNome.trim().length < 2) {
    erros.push({
      campo: "favorecidoNome",
      mensagem: "Informe o nome do favorecido.",
    });
  }

  if (tipoPorDocumento(entrada.favorecidoDocumento) === null) {
    erros.push({
      campo: "favorecidoDocumento",
      mensagem: "CNPJ/CPF inválido — confira os dígitos.",
    });
  }

  if (entrada.valorCentavos === null || entrada.valorCentavos <= 0) {
    erros.push({ campo: "valorCentavos", mensagem: "Informe o valor pago." });
  }

  if (!entrada.dataPagamento || !ehDataValida(entrada.dataPagamento)) {
    erros.push({
      campo: "dataPagamento",
      mensagem: "Informe a data em que o pagamento saiu.",
    });
  } else if (entrada.dataPagamento > hojeIso) {
    // Regime de caixa: data no futuro jogaria o custo no ano errado sem que
    // ninguém percebesse.
    erros.push({
      campo: "dataPagamento",
      mensagem:
        "Data no futuro — o custo entra no ano do pagamento, registre a data em que o dinheiro saiu.",
    });
  }

  // ⚠️ A FALTA DO COMPROVANTE NÃO É MAIS ERRO (CONTAI-019, critério 46).
  //
  // Havia aqui um erro de campo com a mensagem "sem ele o pagamento não é
  // aceito". O `contador` derrubou no ADENDO 2 §5 do parecer de 2026-08-18 e o
  // Mateus reprovou o botão lendo o mock, no mesmo dia:
  //
  //     "Não é 'opcional com aviso', e não é bloqueio duro. [...] O botão
  //     grava sempre; o que muda é o ESTADO QUE NASCE."
  //     Parecer §4: *nunca recuse o registro de um fato consumado.*
  //
  // O bloqueio aplicava DOIS PESOS ao mesmo fato do mundo — a confirmação de
  // compromisso já gravava sem comprovante — e o mais duro dos dois é o que
  // empurra para NÃO registrar, que é a falha da meta 1 pelo lado de fora.
  //
  // O que substitui o erro não é nada: é o estado. Sem comprovante o pagamento
  // grava, `valorElegivelDoPagamento` devolve 0 (não entra no custo
  // confirmado) e nasce a pendência "pago sem comprovante", com o peso do
  // favorecido — ver `rotulosPagoSemComprovante` abaixo.
  //
  // O ÚNICO bloqueio que fica é a DATA FUTURA, e ele fica literalmente
  // (critério 2 do CONTAI-019, §1 do parecer): pagamento só existe com
  // desembolso ocorrido. Data futura tem outro lugar para morar agora — é
  // compromisso, não pagamento.

  return erros;
}

// ── Pago sem comprovante (CONTAI-019, critérios 46-47) ───────────────────

/**
 * O peso da pendência "pago sem comprovante" **muda com o favorecido**, e a
 * diferença é fiscal, não estética (ADENDO 2 do parecer de 2026-08-18, §1 e
 * tabela do §5):
 *
 * - **PF com recibo**: o comprovante é **constitutivo**. "Recibo é papel
 *   unilateral, escrito por quem tem interesse no valor; sozinho ele não prova
 *   nada. Sem o rastro bancário não existe condição 3 — não é custo mal
 *   documentado, é custo inexistente para efeito de prova." Vermelha, no mesmo
 *   peso de "pago sem nota".
 * - **PJ com NF**: a NF sustenta o *quê*, o *quanto* e o *para quem*; o que
 *   ela não sustenta é que houve desembolso, quando e por ele. Amarela.
 *
 * Os textos abaixo são **copiados** da tabela do §5, não reescritos.
 */
export interface RotulosPagoSemComprovante {
  chip: string;
  consequencia: string;
  gravidade: "red" | "amb";
}

const SEM_COMPROVANTE_PJ: RotulosPagoSemComprovante = {
  chip: "Pago sem comprovante",
  consequencia:
    "pago sem comprovante — o custo existe, ainda não está demonstrável",
  gravidade: "amb",
};

const SEM_COMPROVANTE_PF: RotulosPagoSemComprovante = {
  chip: "Pago sem comprovante",
  consequencia:
    "sem o comprovante da transferência, este recibo não sustenta custo nenhum",
  gravidade: "red",
};

/**
 * Favorecido de tipo desconhecido (pagamento sem `favorecido_id`).
 *
 * ⚠️ **RATIFICADO pelo `contador` no ADENDO 3 §G.3**, `[Certain]`, e o texto
 * abaixo é a **terceira linha da tabela do ADENDO 2 §5** — literal, não
 * reescrito. A pergunta subiu no Gate 1a porque o parecer só tinha duas
 * linhas, PJ e PF.
 *
 * **Vermelho**, pelo motivo aceito: "sem saber o tipo, não dá para DESCARTAR o
 * caminho PF, em que o comprovante é constitutivo do custo. Subestimar o peso
 * de uma pendência é o erro que faz ela não ser resolvida; superestimar custa
 * um anexo a mais."
 *
 * O texto **não afirma consequência fiscal**, e está certo que não afirme:
 * "afirmar qual dos dois regimes se aplica, sem saber o tipo, seria inventar
 * fato. Ele nomeia a incerteza e pede o dado que a resolve."
 *
 * ⚠️ **O vermelho aqui é PROVISÓRIO.** Informado o CNPJ/CPF, a pendência é
 * RECLASSIFICADA para a linha PJ (amarela) ou PF (vermelha) — "vermelho por
 * desconhecimento não pode virar vermelho permanente de uma pendência que era
 * amarela". A reclassificação acontece sozinha: `calcularResumo` deriva a
 * gravidade do `favorecidoTipo` a cada leitura, e não guarda cor nenhuma.
 */
const SEM_COMPROVANTE_DESCONHECIDO: RotulosPagoSemComprovante = {
  chip: "Pago sem comprovante",
  consequencia:
    "sem o comprovante não dá para dizer o quanto este pagamento sustenta — informe o CNPJ/CPF do favorecido: para PF o comprovante da transferência é o que constitui o custo",
  gravidade: "red",
};

export function rotulosPagoSemComprovante(
  tipo: TipoFavorecido | null,
): RotulosPagoSemComprovante {
  if (tipo === "pj") return SEM_COMPROVANTE_PJ;
  if (tipo === "pf") return SEM_COMPROVANTE_PF;
  return SEM_COMPROVANTE_DESCONHECIDO;
}

// ── Diferença não explicada (CONTAI-019, §F.4) ───────────────────────────

/**
 * Título da pendência, com o valor interpolado (critério 31e).
 *
 * ⚠️ A minuta anterior do `designer` foi **reprovada por motivo fiscal**:
 * ancorava a consequência no valor PREVISTO, e previsão não decide custo
 * nenhum — quem limita é o **documento hábil**. Com previsto de R$ 9.000 e
 * nota de R$ 10.000 a frase estaria errada em tela. O texto abaixo ancora no
 * **pagamento**, e é copiado do §F.4 literalmente.
 */
export function tituloDiferencaSemExplicacao(centavos: number): string {
  return `${formatarBRL(centavos)} do que você pagou ainda estão sem explicação.`;
}

/** §F.4, segunda metade — literal. */
export const CORPO_DIFERENCA_SEM_EXPLICACAO =
  "Enquanto estiverem, ficam fora do custo de aquisição. Se forem juros, multa " +
  "ou algo que não é da obra, ficam fora para sempre — e não há o que cobrar. " +
  "Se forem obra, entram no custo quando houver nota no seu CPF que os cubra; " +
  "até lá, contam como pago sem nota.";

export function textoDiferencaSemExplicacao(centavos: number): string {
  return `${tituloDiferencaSemExplicacao(centavos)} ${CORPO_DIFERENCA_SEM_EXPLICACAO}`;
}

/**
 * §F.5 — a frase que substitui "…não a da nota, regime de caixa" no formulário
 * de pagamento (decisão 10 do fechamento de 18/08, ratificada pelo `contador`).
 *
 * O critério 7 do CONTAI-019 proíbe "regime de caixa" em tela: é o **nome** da
 * regra, não a regra, e não ensina nada a um usuário de uma pessoa só. **O
 * exemplo fica** — é ele que ensina, e a sentença abstrata sozinha é
 * esquecível.
 */
export const DATA_QUE_VALE_PARA_O_CUSTO =
  "A data que vale para o custo é a do pagamento, não a da nota. Nota de " +
  "dezembro paga em janeiro é custo do ano seguinte.";
