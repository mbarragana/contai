/**
 * Regras fiscais do registro de documento (CONTAI-001, Gate Fiscal).
 * Módulo puro: nenhuma dependência de rede ou de UI.
 *
 * Fonte das regras — nada aqui é inferido:
 * - "Documento hábil: NF de material com CPF do dono como destinatário; NF de
 *   serviço com ele como tomador. Divergência → quarentena" (Gate Fiscal)
 * - "NF de serviço PJ → capturar flag de retenção 11%" (Gate Fiscal)
 * - "Boleto NÃO é documento hábil sozinho — é título de cobrança" (Gate Fiscal)
 * - "Classificação material vs. serviço: incerteza → revisão humana, nunca
 *   chute silencioso" (Gate Fiscal)
 *
 * CONTAI-004 (parecer 2026-08-16, Parte 1, R1-R5):
 * - "Se tipo ∈ {nf_material, nf_servico} → numero e data_emissao obrigatórios",
 *   "e se status = quarentena → continuam obrigatórios", "se tipo = boleto →
 *   ambos opcionais"
 * - "Se data_emissao posterior a hoje → recusar" — coerência documental, com
 *   mensagem PRÓPRIA, nunca a da data de pagamento futura
 * - "numero é texto literal — zeros à esquerda, letras, barras, pontos"
 */

import type { Classificacao, StatusDocumento, TipoDocumento } from "@/lib/types";
import { tipoPorDocumento } from "./identificacao";
import { ehDataValida } from "./pagamento";

/** Check fiscal obrigatório 1 — "esta nota está no seu CPF?" (critério 4). */
export type RespostaCpf = "sim" | "nao";

/** Check fiscal obrigatório 2 — "tem retenção de 11%?" (critério 5). */
export type RespostaRetencao = "sim" | "nao" | "nao_sei";

export interface EntradaDocumento {
  tipo: TipoDocumento | null;
  favorecidoNome: string;
  favorecidoDocumento: string;
  valorCentavos: number | null;
  /**
   * Número impresso na nota — TEXTO, sempre (R2). Nunca convertido para
   * número, nunca normalizado: `000123`, `1042/A` e `2026.000.114` são
   * identificações diferentes e todas legítimas.
   */
  numero: string;
  /**
   * Série da nota — campo PRÓPRIO, nunca grudada no número (R6). Opcional:
   * nem toda NFS-e municipal tem série.
   */
  serie: string;
  /**
   * ISO (yyyy-mm-dd) — data em que a NOTA foi emitida.
   *
   * ⚠️ Não é a data do custo. O ano-calendário do custo sai de
   * `pagamento.data_pagamento` (regime de caixa). Esta aqui identifica o
   * documento, posiciona a nota na janela sem CNO e dá a competência da
   * aferição do INSS.
   */
  dataEmissao: string;
  /** ISO (yyyy-mm-dd) — só boleto. */
  vencimento: string | null;
  classificacao: Classificacao | null;
  notaNoCpf: RespostaCpf | null;
  retencao11: RespostaRetencao | null;
  temArquivo: boolean;
}

export interface ErroCampo {
  campo: keyof EntradaDocumento;
  mensagem: string;
}

export const MOTIVO_QUARENTENA_CPF =
  "Documento não está no CPF do dono da obra — não entra no custo de aquisição.";

export const CONSEQUENCIA_QUARENTENA =
  "Não entra no custo de aquisição. Peça a nota no seu CPF.";

export const CONSEQUENCIA_SEM_RETENCAO =
  "Não abate na aferição do INSS da obra (SERO).";

export const CONSEQUENCIA_BOLETO =
  "Boleto não é documento hábil. O custo só se sustenta com a NF.";

// ── CONTAI-004: identificação da nota ────────────────────────────────────

/**
 * Ajuda do campo `numero`, sob o rótulo. Diz a regra R2 na cara do usuário:
 * o que ele digitar é o que fica.
 */
export const AJUDA_NUMERO =
  "Copie como está impresso — zeros à esquerda e letras contam. Nunca é normalizado.";

/**
 * Ajuda do campo `serie` (mock `#s1`/`#s3`). R6, literal: "capturar `serie` em
 * campo próprio, nunca concatenada no número" — "1042/2" no campo do número
 * são dois dados grudados que ninguém separa depois.
 */
export const AJUDA_SERIE = "Campo próprio — nunca junto do número.";

/**
 * Ajuda do campo `data_emissao` — critério 8: o rótulo diz o que a data É e o
 * que ela NÃO É. Paráfrase da tabela do parecer 2026-08-16, Parte 1, §3
 * ("data_emissao governa identificação, janela do CNO e competência; nunca
 * governa o ano do custo"). Sem esta frase o campo é lido como "a data que
 * vale para o IR", que é exatamente a troca que o parecer nomeia.
 */
export const AJUDA_DATA_EMISSAO =
  "Identifica a nota e a janela do CNO. Não decide o ano do custo — quem decide é a data do pagamento.";

/**
 * ⚠️ Mensagem PRÓPRIA da data de emissão futura (R4). Ela NÃO é a mensagem da
 * data de pagamento futura (`lib/fiscal/pagamento.ts`), e trocar uma pela
 * outra é defeito fiscal, não economia de string: aquela fala de regime de
 * caixa ("o custo entra no ano do pagamento"), esta fala de coerência
 * documental. Cópia quase literal do parecer: "Documento não existe antes de
 * ser emitido."
 *
 * Data ANTERIOR ao início da obra é legítima e não gera aviso nenhum —
 * projeto, ART, ITBI e escritura antecedem a obra.
 */
export const EMISSAO_NO_FUTURO =
  "Data de emissão não pode ser depois de hoje — documento não existe antes de ser emitido.";

/**
 * Pendência de campo faltante (critério 13 / parecer §4). ÂMBAR, nunca
 * vermelha, e fora de qualquer headline: o custo NÃO está em risco — o
 * documento hábil está no acervo e continua valendo. O que se perde é a
 * identificação da nota na discriminação e a presença dela na lista de
 * cobrança do CNO.
 */
export const PENDENCIA_IDENTIFICACAO_TITULO = "Falta o número ou a data da nota";

export const PENDENCIA_IDENTIFICACAO_EFEITO =
  "O custo não está em risco: o documento está no acervo e continua valendo. " +
  "Sem o número e a data, a discriminação do ano sai sem identificar esta " +
  "nota, e ela fica de fora da lista de cobrança do CNO.";

/**
 * Quais tipos exigem identificação da nota (R5).
 *
 * Boleto fica de fora e isso é regra, não esquecimento: título de cobrança não
 * é documentação hábil, não compõe discriminação nenhuma, e exigir campo em
 * documento que não gera saída fiscal é atrito sem consequência — que fabrica
 * carimbo. O campo obrigatório do boleto segue sendo `vencimento`.
 */
export function exigeIdentificacaoDaNota(tipo: TipoDocumento | null): boolean {
  return tipo === "nf_material" || tipo === "nf_servico";
}

/**
 * O `numero` como ele vai para o banco (R2).
 *
 * A ÚNICA coisa que sai é o espaço em volta do que foi digitado — espaço não
 * é parte de número impresso em nota nenhuma, e sem isso `"   "` viraria um
 * número. Tudo o mais é preservado: zeros à esquerda, letras, barras, pontos,
 * hífens e a caixa das letras. Proibido `Number()`, `parseInt`, `replace` de
 * zeros, `toUpperCase` ou qualquer "normalização" — NFS-e municipal usa
 * numeração própria e converter destrói a identificação da nota.
 */
export function numeroParaBanco(numero: string): string | null {
  return numero.trim() || null;
}

/**
 * A `serie` como ela vai para o banco. Mesma disciplina do número: nada de
 * normalizar, e ausência é `null` — NUNCA `""`, "S/N" ou "1" por conveniência.
 * Série inventada estragaria a comparação de duplicidade que ela existe para
 * afinar.
 */
export function serieParaBanco(serie: string): string | null {
  return serie.trim() || null;
}

/** Um documento já registrado, no mínimo que a checagem de duplicidade usa. */
export interface DocumentoRegistrado {
  id: string;
  numero: string | null;
  serie: string | null;
  /** CNPJ/CPF do emitente, só dígitos. */
  emitenteDocumento: string | null;
  /** ISO (yyyy-mm-dd) do dia em que o registro entrou. */
  registradoEm: string;
}

/**
 * Possível duplicidade (critério 11 / R7): mesmo número, mesma SÉRIE e mesmo
 * emitente, na mesma obra. AVISO, nunca bloqueio.
 *
 * ⚠️ **Não existe unicidade global de `numero`** — número é único por
 * emitente + série + modelo. Duas notas de fornecedores diferentes com o
 * número 1042 são duas notas legítimas; **duas notas do MESMO emitente com o
 * mesmo número e séries diferentes também são**, e é por isso que a série
 * entra aqui: sem ela, a série 2 do emitente acusaria a série 1 como
 * duplicata, e aviso que erra é aviso que o Mateus aprende a ignorar.
 *
 * Série ausente nos dois lados (`null`) conta como igual: é o caso comum da
 * NFS-e municipal, e "sem série" é um estado, não um coringa.
 *
 * ⚠️ **LIMITAÇÃO ACEITA, e ela é conhecida — não é regra completa** (Gate 2 do
 * CONTAI-004, `contador` + `cto-obra`, mesmo caso por dois ângulos): a MESMA
 * nota digitada duas vezes, uma com série e outra em branco por descuido, NÃO
 * dispara aviso — série ausente e série preenchida contam como identidades
 * diferentes. Em registro legado o `null` significa "não foi perguntado", e
 * não "não tem série", o que amplia o mesmo buraco.
 *
 * O risco assimétrico foi escolhido de propósito, nas palavras do `contador`:
 * o aviso é SÓ aviso e nunca bloqueia salvar, então o falso-POSITIVO (duas
 * notas legítimas de séries diferentes acusadas de duplicidade) é pior que o
 * falso-NEGATIVO — ele ensina o Mateus a ignorar o aviso, e um aviso ignorado
 * não defende nada contra custo contado duas vezes. Quem fecha este buraco de
 * verdade é `chave_acesso` (coluna já criada aqui, preenchida pela US-008):
 * ela identifica a nota sem depender de número, série nem normalização.
 *
 * A comparação do número é LITERAL (R2): `000123` não é `123`. Comparar
 * normalizado é a mesma proibição da gravação, com outro nome — e a saída
 * definitiva para o `000.001.042` do DANFE contra o `1042` do XML é a chave de
 * acesso (coluna `documento.chave_acesso`, criada por este ticket e preenchida
 * pela US-008): ela identifica a nota sem depender de normalização nenhuma.
 */
export function duplicataDe(
  entrada: { numero: string; serie: string; emitenteDocumento: string },
  registrados: DocumentoRegistrado[],
): DocumentoRegistrado | null {
  const numero = entrada.numero.trim();
  const serie = serieParaBanco(entrada.serie);
  const emitente = entrada.emitenteDocumento.trim();
  if (!numero || !emitente) return null;
  return (
    registrados.find(
      (d) =>
        d.numero === numero &&
        d.serie === serie &&
        d.emitenteDocumento === emitente,
    ) ?? null
  );
}

/**
 * Proposta de classificação a partir do tipo escolhido. Boleto não diz o que
 * foi comprado → `null`, e o formulário exige resposta humana.
 */
export function classificacaoProposta(
  tipo: TipoDocumento | null,
): Classificacao | null {
  if (tipo === "nf_material") return "material";
  if (tipo === "nf_servico") return "mao_obra";
  return null;
}

/** A pergunta de retenção só faz sentido em NF de serviço. */
export function exigeRetencao(tipo: TipoDocumento | null): boolean {
  return tipo === "nf_servico";
}

/** "não sei" não vira "não": vai como desconhecido (null) para o banco. */
export function retencaoParaBanco(
  resposta: RespostaRetencao | null,
): boolean | null {
  if (resposta === "sim") return true;
  if (resposta === "nao") return false;
  return null;
}

/**
 * Status de nascimento do documento.
 * - nota fora do CPF → quarentena (constraint documento_quarentena_coerente)
 * - boleto → aguardando_pagamento: título de cobrança, não sustenta custo
 * - demais → registrado
 */
export function statusDocumento(
  tipo: TipoDocumento | null,
  notaNoCpf: RespostaCpf | null,
): StatusDocumento {
  if (notaNoCpf === "nao") return "quarentena";
  if (tipo === "boleto") return "aguardando_pagamento";
  return "registrado";
}

export function motivoQuarentena(notaNoCpf: RespostaCpf | null): string | null {
  return notaNoCpf === "nao" ? MOTIVO_QUARENTENA_CPF : null;
}

/**
 * Aviso do INSS (não bloqueia — critério 5): NF de serviço sem retenção
 * confirmada não abate na aferição do SERO.
 */
export function avisaInss(
  tipo: TipoDocumento | null,
  retencao11: RespostaRetencao | null,
): boolean {
  return exigeRetencao(tipo) && retencao11 !== null && retencao11 !== "sim";
}

/**
 * Validação do formulário. Nada é aceito em silêncio: sem arquivo, sem os
 * dois checks fiscais e sem classificação, não salva.
 *
 * `hojeIso` entra por parâmetro (convenção de lib/fiscal/*): o módulo continua
 * puro e o teste consegue fixar "hoje" sem mexer no relógio.
 *
 * ⚠️ **NÃO EXISTE, E NÃO PODE EXISTIR, VALIDAÇÃO ENTRE `dataEmissao` E A DATA
 * DO PAGAMENTO** (R1 do parecer 2026-08-16, a ressalva mais cara do ticket).
 * `data_pagamento >= data_emissao` parece higiene e quebra o caso MAIS
 * FREQUENTE do projeto: PIX mensal à empreiteira e NF consolidada emitida
 * meses depois (Relato 002, D6). "NF emitida em 12/12/2026, paga em 2027" é
 * correto; o inverso — pago antes de a nota sair — também é. As duas datas não
 * se derivam nem se ordenam uma pela outra.
 *
 * Quem tranca isso não é este comentário: é
 * `lib/fiscal/documento.test.ts` → "R1: nenhuma ordem entre emissão e
 * pagamento", que fica VERMELHO se alguém acrescentar a regra. Comentário não
 * protege nada — lição do `cnoReferenciado` hard-coded (Gate 2 do CONTAI-003).
 */
export function validarDocumento(
  entrada: EntradaDocumento,
  hojeIso: string,
): ErroCampo[] {
  const erros: ErroCampo[] = [];

  // Critério 6 + decisão manual-first: anexo obrigatório, o acervo nasce aqui.
  if (!entrada.temArquivo) {
    erros.push({
      campo: "temArquivo",
      mensagem: "Anexe o arquivo do documento — sem ele o registro não é aceito.",
    });
  }

  if (entrada.tipo === null) {
    erros.push({ campo: "tipo", mensagem: "Escolha o tipo do documento." });
  }

  if (entrada.favorecidoNome.trim().length < 2) {
    erros.push({
      campo: "favorecidoNome",
      mensagem: "Informe o nome do emitente.",
    });
  }

  if (tipoPorDocumento(entrada.favorecidoDocumento) === null) {
    erros.push({
      campo: "favorecidoDocumento",
      mensagem: "CNPJ/CPF inválido — confira os dígitos na nota.",
    });
  }

  if (entrada.valorCentavos === null || entrada.valorCentavos <= 0) {
    erros.push({ campo: "valorCentavos", mensagem: "Informe o valor." });
  }

  // R5: identificação da nota. Bloqueante nos dois tipos de NF, INCLUSIVE
  // quando a nota vai para quarentena — contraintuitivo e correto: é a nota
  // errada que precisa ser identificada para ser cancelada e reemitida junto
  // ao fornecedor (em NF-e, carta de correção NÃO altera destinatário). Sem
  // número não há o que pedir. Por isso a checagem não olha `notaNoCpf`.
  if (exigeIdentificacaoDaNota(entrada.tipo)) {
    if (numeroParaBanco(entrada.numero) === null) {
      erros.push({
        campo: "numero",
        mensagem: "Informe o número da nota, como está impresso nela.",
      });
    }

    if (!entrada.dataEmissao || !ehDataValida(entrada.dataEmissao)) {
      erros.push({
        campo: "dataEmissao",
        mensagem: "Informe a data de emissão que está na nota.",
      });
    } else if (entrada.dataEmissao > hojeIso) {
      // R4 — recusa com mensagem própria. Data anterior ao início da obra
      // passa sem aviso nenhum: projeto, ART, ITBI e escritura antecedem a
      // obra e são custo legítimo.
      erros.push({ campo: "dataEmissao", mensagem: EMISSAO_NO_FUTURO });
    }
  }

  if (entrada.tipo === "boleto" && !entrada.vencimento) {
    erros.push({
      campo: "vencimento",
      mensagem: "Informe o vencimento do boleto.",
    });
  }

  // Gate Fiscal: classificação incerta → revisão humana, nunca chute.
  if (entrada.classificacao === null) {
    erros.push({
      campo: "classificacao",
      mensagem: "Classifique como material ou mão de obra.",
    });
  }

  // Critério 4: sem resposta não salva.
  if (entrada.notaNoCpf === null) {
    erros.push({
      campo: "notaNoCpf",
      mensagem: "Responda se o documento está no seu CPF.",
    });
  }

  // Critério 5: obrigatório responder em NF de serviço ("não sei" é resposta).
  if (exigeRetencao(entrada.tipo) && entrada.retencao11 === null) {
    erros.push({
      campo: "retencao11",
      mensagem: "Responda sobre a retenção de 11% (vale responder 'não sei').",
    });
  }

  return erros;
}
