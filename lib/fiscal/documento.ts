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

import type {
  Classificacao,
  Documento,
  StatusDocumento,
  TipoDocumento,
} from "@/lib/types";
import { tipoPorDocumento } from "./identificacao";
import { CONSEQUENCIA_CNO_DA_NOTA } from "./obra";
import { ehDataValida } from "./pagamento";

/** Check fiscal obrigatório 1 — "esta nota está no seu CPF?" (critério 4). */
export type RespostaCpf = "sim" | "nao";

/** Check fiscal obrigatório 2 — "tem retenção de 11%?" (critério 5). */
export type RespostaRetencao = "sim" | "nao" | "nao_sei";

/**
 * Check fiscal obrigatório 3 — **"qual CNO está impresso nesta nota?"**
 * (CONTAI-007, critério 1).
 *
 * ⚠️ **ESCOLHA, NUNCA DIGITAÇÃO** — é o pre-mortem 1 do ticket, e ele é
 * bloqueante: *"se o mock trouxer campo livre de 14 dígitos, devolvo"*. O CNO
 * das obras cadastradas o app já tem; o que ele não tem é o que está no papel,
 * e isso se responde com um toque.
 *
 * Os três desfechos são fiscalmente distintos:
 * - `desta_obra` → grava o CNO da obra como o impresso na nota; é o único que
 *   abate a aferição;
 * - `outra_obra` → **BLOQUEIO** (critério 2). Não vira pendência porque não há
 *   conserto depois da emissão — a saída é registrar na obra do CNO impresso;
 * - `nao_traz` → **PENDÊNCIA** (critério 3). Não abate a aferição, e continua
 *   sendo documentação hábil para o custo de aquisição (IN SRF 84/2001,
 *   art. 17). Bloquear aqui perderia o custo para salvar o INSS.
 */
export type RespostaCnoNota = "desta_obra" | "outra_obra" | "nao_traz";

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
  /**
   * CONTAI-007 — só NF de serviço. `null` é "ainda não respondeu", e não salva
   * (critério 1): em branco silencioso é o estado que o ticket inteiro existe
   * para impedir.
   */
  cnoNaNota: RespostaCnoNota | null;
  /**
   * O CNO da obra AFIRMADA NA TELA, ou `null` quando ela não tem CNO.
   *
   * Entra na validação, e não só na montagem do render, por decisão do Gate 2:
   * é ele que torna *"é o CNO desta obra"* impossível de afirmar numa obra que
   * não tem CNO. A tela já esconde a opção, mas esconder um botão é proteção de
   * render — sobrevive até o primeiro refactor, e o check do banco só acusaria
   * depois de o upload já ter ido para o acervo.
   */
  cnoDaObra: string | null;
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

/**
 * **CONTAI-005 — a linha nova do card de boleto** (Bloco 3 do parecer de
 * 2026-08-16; as duas de cima não mudam).
 *
 * O boleto **saiu do headline** de "Custo em risco no IR", e a razão é mais
 * forte que evitar contar duas vezes: no regime de caixa, **sem desembolso não
 * há dispêndio** — não existe custo a perder ainda. O risco real do boleto é de
 * outra moeda (juros e multa de mora, que não integram o custo de aquisição).
 *
 * ⚠️ Sem esta linha, a saída do boleto do total viraria encolhimento
 * silencioso: o Mateus veria o número cair e não saberia por quê.
 */
export const BOLETO_FORA_DO_TOTAL =
  "Não entra no total acima: enquanto não for pago, não houve dispêndio.";

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

// ── CONTAI-007 · o CNO impresso na nota ─────────────────────────────────

/**
 * A pergunta do CNO só existe em **NF de serviço** (critério 1).
 *
 * Material e boleto ficam de fora, e isso é regra, não esquecimento: a dedução
 * da base de aferição do SERO é amarrada ao CNO impresso na NF de SERVIÇO com
 * retenção de 11% — material não abate aferição nenhuma, e boleto não é
 * documentação hábil. Perguntar ali é atrito sem consequência, que fabrica
 * carimbo.
 */
export function exigeCnoReferenciado(tipo: TipoDocumento | null): boolean {
  return tipo === "nf_servico";
}

/**
 * **Critério 2 — bloqueio, não aviso.** O registro não acontece: sem linha em
 * `documento` e sem objeto no acervo (critério 6).
 *
 * ⚠️ Não é pendência, e a assimetria com o critério 3 é a regra inteira (Gate
 * Fiscal, 2ª condição): *"a pendência é o remédio para o que ainda dá para
 * corrigir; esta não dá"*. Depois de emitida, a nota com o CNO da outra obra
 * não se conserta — o que se conserta é ONDE ela é registrada.
 */
export function bloqueiaPorCnoDeOutraObra(
  tipo: TipoDocumento | null,
  resposta: RespostaCnoNota | null,
): boolean {
  return exigeCnoReferenciado(tipo) && resposta === "outra_obra";
}

/** Critério 3 — salva, com pendência e com a consequência dita na hora. */
export function pendenteDeCno(
  tipo: TipoDocumento | null,
  resposta: RespostaCnoNota | null,
): boolean {
  return exigeCnoReferenciado(tipo) && resposta === "nao_traz";
}

/**
 * O que vai para `documento.cno_referenciado` — **o número, nunca um "sim"**.
 *
 * `cnoDaObra` é o CNO da obra **afirmada na tela** no momento do registro, que
 * é o que a resposta `desta_obra` afirma estar impresso no papel. Gravar o
 * número (e não um booleano "é o desta obra") é o que faz a divergência
 * aparecer se o cadastro da obra for corrigido depois: o papel não muda quando
 * o cadastro muda.
 *
 * `outra_obra` devolve `null` porque **não existe gravação nesse caso** — o
 * registro é barrado antes. Devolver aqui o CNO da outra obra seria oferecer a
 * gravação que o critério 2 proíbe.
 */
export function cnoReferenciadoParaBanco(
  tipo: TipoDocumento | null,
  resposta: RespostaCnoNota | null,
  cnoDaObra: string | null,
): string | null {
  if (!exigeCnoReferenciado(tipo)) return null;
  return resposta === "desta_obra" ? cnoDaObra : null;
}

/**
 * O que vai para `documento.nota_traz_cno` — tri-estado, igual a `retencao_11`.
 *
 * ⚠️ `nao_traz` vira `false`, **nunca `null`**: `null` significa "não foi
 * perguntado", e colapsar os dois é o branco silencioso que o critério 3
 * proíbe. É por esta distinção que existem duas colunas, e não uma.
 */
export function notaTrazCnoParaBanco(
  tipo: TipoDocumento | null,
  resposta: RespostaCnoNota | null,
): boolean | null {
  if (!exigeCnoReferenciado(tipo)) return null;
  if (resposta === "desta_obra") return true;
  if (resposta === "nao_traz") return false;
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

// ── CONTAI-033 · "registrado sem arquivo" é DERIVADO, nunca um status ─────
//
// Parecer `2026-08-23-anexo-no-desembolso-do-terreno.md`, ADENDO 1 §A.3,
// Guarda 3 + nota de engenharia: `status_documento` **não ganha valor novo**
// (D52, fechada pelo `cto-obra`). `quarentena` significa *destinatário ≠ CPF*,
// `motivo_quarentena` é escrito pelo sistema e `status` é derivado e NÃO
// CORRIGÍVEL — sobrecarregá-lo corrompe os três, e colidiria com o
// `aguardando_pagamento` do boleto. "Sem arquivo" é uma SEGUNDA DIMENSÃO.

/**
 * O estado que a tela mostra. Quatro valores, e a ordem das perguntas é a
 * ordem da gravidade fiscal: quarentena está fora do custo de aquisição
 * inteiro; boleto não sustenta custo sozinho; sem arquivo não sustenta nada
 * até o papel chegar.
 *
 * ⚠️ `registrado_sem_arquivo` **não existe no banco** — é `arquivo_path IS
 * NULL` sobre um `status` qualquer. Um documento pode estar em quarentena E
 * sem arquivo ao mesmo tempo (confirmado pelo `contador` em 2026-09-19: as
 * guardas são ADITIVAS, nunca mutuamente exclusivas), e nesse caso esta função
 * devolve `quarentena` — quem desenha a tela mostra as DUAS pendências, pelo
 * predicado `arquivoPath === null`, e não uma no lugar da outra.
 */
export type EstadoExibido =
  | "quarentena"
  | "aguardando_pagamento"
  | "registrado"
  | "registrado_sem_arquivo";

/**
 * ⚠️ **O PREDICADO ÚNICO da pendência "Nota sem arquivo"** — e ele é SEPARADO
 * de `estadoExibido` de propósito, não por redundância.
 *
 * `estadoExibido` responde *"que rótulo esta nota exibe?"* e devolve **um**
 * valor; esta função responde *"esta nota tem a pendência do arquivo?"*, que é
 * outra pergunta. Num documento em quarentena **sem** arquivo, o rótulo é
 * `quarentena` (o estado mais grave) e este predicado continua `true` — é por
 * ele que a tela mostra as **DUAS** pendências, como o `contador` confirmou em
 * 2026-09-19: as guardas são ADITIVAS, e mostrar só uma reabre a D47.
 *
 * Usar o rótulo como se fosse o predicado foi defeito real, pego pelo E2E no
 * Gate 1: `estadoExibido(d) === "registrado_sem_arquivo"` escondia o bloco
 * justamente no caso em que as duas pendências coexistem.
 *
 * ⚠️ **Todo consumidor usa ESTA função** — a tela, o agregado do `ResumoObra` e
 * o veto da saída anual. `d.arquivoPath === null` escrito à mão em cada lugar é
 * o "segundo caminho" do pre-mortem 1 do ticket.
 */
export function faltaOArquivo(
  documento: Pick<Documento, "arquivoPath">,
): boolean {
  return documento.arquivoPath === null;
}

/**
 * ⚠️ **A ÚNICA função que monta este rótulo** (critério 5 do CONTAI-033):
 * nenhuma tela lê `status` cru nem escreve "sem arquivo" à mão. Duas leituras
 * do mesmo estado divergem no dia em que só uma for atualizada — é a D46 com
 * outro rosto.
 *
 * ⚠️ Não é o predicado da PENDÊNCIA — para isso existe `faltaOArquivo` acima.
 */
export function estadoExibido(
  documento: Pick<Documento, "status" | "arquivoPath">,
): EstadoExibido {
  if (documento.status === "quarentena") return "quarentena";
  if (documento.status === "aguardando_pagamento") return "aguardando_pagamento";
  if (faltaOArquivo(documento)) return "registrado_sem_arquivo";
  return "registrado";
}

// ── Textos do CONTAI-033 — LITERAIS do parecer, §A.7.1 a §A.7.3 ──────────
//
// ⚠️ Copiados, não redigidos (regra do `CLAUDE.md`: texto de tela com
// consequência fiscal se copia do parecer). Moram aqui, e não na tela, porque
// o diálogo do formulário, o detalhe do documento e o card da home mostram os
// MESMOS textos — três cópias divergem, e a primeira coisa que diverge é a
// consequência fiscal.

/** §A.7.1 — título do diálogo, no ato de salvar sem o arquivo. */
export const SEM_ARQUIVO_DIALOGO_TITULO = "Salvar sem o arquivo da nota?";

/** §A.7.1 — primeiro parágrafo: para que serve gravar sem o papel. */
export const SEM_ARQUIVO_DIALOGO_PORQUE =
  "Os dados ficam guardados e servem para cobrar a nota do emitente enquanto " +
  "você ainda tem parcela a liberar.";

/**
 * §A.7.1 — segundo parágrafo: as guardas 1 e 2, ditas antes de gravar.
 *
 * ⚠️ O trecho final não é enfeite: *"o abatimento depende da nota de serviço
 * com a retenção de 11%, não da lembrança dela"* é a Guarda 2 por extenso — o
 * erro aqui não custa glosa na venda, custa **pagar o INSS duas vezes**.
 */
export const SEM_ARQUIVO_DIALOGO_CONSEQUENCIA =
  "Sem o arquivo, esta nota não sustenta custo nenhum e não abate a aferição " +
  "do INSS desta obra — o abatimento depende da nota de serviço com a " +
  "retenção de 11%, não da lembrança dela.";

/** §A.7.1 — o botão que grava assim mesmo. */
export const SEM_ARQUIVO_DIALOGO_SALVAR = "Salvar e cobrar a nota";

/** §A.7.1 — o botão que volta ao campo do anexo, sem perder nada digitado. */
export const SEM_ARQUIVO_DIALOGO_ANEXAR = "Anexar agora";

/**
 * §A.7.2 — o chip. **Distinto de "Pago sem nota"**, e a distinção é do
 * parecer: *"lá falta a nota inteira; aqui a nota é conhecida e falta o papel
 * dela"*.
 *
 * ⚠️ **VERMELHO**, confirmado pelo `contador` em 2026-09-19 pela régua do
 * ADENDO 2 §A.4 (*"saiu? → tem apoio hábil no ano certo? → não = vermelho"*):
 * sem apoio hábil nenhum — o arquivo que falta é o próprio documento hábil,
 * não uma prova de pagamento sobre nota que já existe. Mais grave que o caso
 * PJ-âmbar.
 */
export const CHIP_NOTA_SEM_ARQUIVO = "Nota sem arquivo";

/** §A.7.2 — o que aconteceu e o que isso custa. */
export const NOTA_SEM_ARQUIVO_EFEITO =
  "Você registrou os dados da nota, mas o arquivo não está no acervo. " +
  "Enquanto não estiver, ela não entra no custo comprovável e não abate a " +
  "aferição do INSS.";

/** §A.7.2 — a alavanca, e a janela que fecha sozinha. */
export const NOTA_SEM_ARQUIVO_ALAVANCA =
  "Peça o arquivo ao emitente agora: nota que ficou só na conversa desaparece " +
  "com a conversa, e o próximo pagamento é a última hora em que você tem como " +
  "cobrá-la.";

/** §A.7.3 — por que as duas perguntas voltam quando o arquivo chega. */
export const REPERGUNTA_TITULO =
  "Agora com a nota na mão, confirme o que está impresso nela.";

export const REPERGUNTA_PORQUE =
  "Você respondeu de memória quando registrou. As perguntas voltam porque " +
  "agora há papel para conferir — e é o papel que a fiscalização lê, não o app.";

/**
 * As DUAS LINHAS DE GUARDA visíveis em `/documento/[id]` (mock s2, decisão de
 * design 3) — tornam as guardas 1 e 2 fato de tela, não só de banco.
 *
 * ⚠️ **Redação REVISADA pelo `contador` em 2026-09-19**, e a troca tem motivo:
 * o rótulo original *"Custo confirmado: não"* colidia com
 * `custoConfirmadoAnoCentavos` (total da obra no ano) e se lia como "a obra não
 * tem custo confirmado" em vez de "este documento não sustenta custo".
 * *"Sustentar"* também carrega a reversibilidade — vira "sim" no instante em
 * que o arquivo sobe (Guarda 3).
 */
export const GUARDA_SUSTENTA_CUSTO_ROTULO = "Sustenta custo de aquisição";
export const GUARDA_ABATE_INSS_ROTULO = "Abate no INSS";
export const GUARDA_RESPOSTA_NAO = "não";

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

  // ⚠️ **NÃO EXISTE MAIS RECUSA POR FALTA DE ARQUIVO** (CONTAI-033, parecer
  // ADENDO 1 §A.3): o arquivo é PROVA do que o Mateus digitou, não FONTE dele
  // — emitente, valor e tipo ele leu no WhatsApp/e-mail —, e esperar pelo
  // papel perde o fato (a mídia some com a conversa, e nota nunca registrada é
  // nota nunca cobrada). "Bloquear anexo-PROVA não evita erro nenhum: evita o
  // registro" (§A.0).
  //
  // A falta do arquivo NÃO é erro de campo: é uma pergunta na hora de salvar
  // (o diálogo do §A.7.1, na tela) mais as três guardas do §A.3, que vivem em
  // `ehDocumentoHabil`, em `estadoExibido` e no agregado do `ResumoObra`.
  // Devolvê-la aqui como `ErroCampo` seria a recusa de volta com outro nome.

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

  // CONTAI-007, critérios 1 e 2. Duas condições, e elas são diferentes:
  //
  // - sem resposta → não salva, como todo check fiscal deste formulário;
  // - "é o CNO de outra obra" → **BLOQUEIO**, com a consequência escrita.
  //
  // ⚠️ O bloqueio está AQUI, e não só na tela, e a duplicação é deliberada: é
  // esta linha que garante o critério 6 ("não gera linha em `documento` nem
  // objeto no bucket"). A tela recusa o toque; esta função recusa o SALVAR — e
  // é ela que roda antes do upload para o acervo, em `salvar()`. Uma guarda só
  // na tela sobrevive até o primeiro refactor de render.
  if (exigeCnoReferenciado(entrada.tipo)) {
    if (entrada.cnoNaNota === null) {
      erros.push({
        campo: "cnoNaNota",
        mensagem: "Responda qual CNO está impresso nesta nota.",
      });
    } else if (entrada.cnoNaNota === "outra_obra") {
      erros.push({
        campo: "cnoNaNota",
        mensagem: CONSEQUENCIA_CNO_DA_NOTA,
      });
    } else if (
      entrada.cnoNaNota === "desta_obra" &&
      entrada.cnoDaObra === null
    ) {
      // Afirmação impossível: a obra não tem CNO, logo nenhuma nota pode trazer
      // o CNO dela impresso. A tela nem oferece a opção — esta linha é o que
      // impede a afirmação de chegar ao banco por outro caminho, e impede ANTES
      // do upload para o acervo (o check da migration 0015 só acusaria depois).
      erros.push({
        campo: "cnoNaNota",
        mensagem:
          "Esta obra ainda não tem CNO — nenhuma nota pode trazer o CNO dela impresso.",
      });
    }
  }

  return erros;
}
