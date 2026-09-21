/**
 * Regras da obra: prazo do CNO, escolha da obra ativa e a revalidação de CNO na
 * correção de obra de um registro (CONTAI-003). O custo do TERRENO saiu daqui
 * no CONTAI-010 e mora em `lib/fiscal/terreno.ts` — ver a nota abaixo.
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

import type {
  Documento,
  NaturezaAquisicaoTerreno,
  Obra,
  TipoDocumento,
} from "@/lib/types";
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
 * Os três estados possíveis da data de início — e eles NÃO são a mesma coisa em
 * tela (ressalva do contador, Gate 2 do CONTAI-003): "não informei" e "informei
 * uma data futura" pediam a mesma frase ("informe a data real"), que mente para
 * quem já informou. Data futura é dado a corrigir, não campo em branco.
 */
export type EstadoDataInicio = "ausente" | "futura" | "corrente";

export function estadoDataInicio(
  dataInicio: string,
  hoje: string,
): EstadoDataInicio {
  if (!ehDataValida(dataInicio)) return "ausente";
  return diasEntre(dataInicio, hoje) < 0 ? "futura" : "corrente";
}

/**
 * A frase de prazo só existe quando há data de início conhecida e não futura
 * (regra do adendo): obra que ainda vai começar não tem prazo correndo.
 */
export function temPrazoCorrendo(dataInicio: string, hoje: string): boolean {
  return estadoDataInicio(dataInicio, hoje) === "corrente";
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

/**
 * O FIM da janela sem CNO (CONTAI-007, critério 8).
 *
 * ⚠️ Obra **sem CNO** não tem janela fechada: ela ainda está dentro dela, e o
 * fim é HOJE. É esse o caso da tela 13 do mock do CONTAI-003 — o link *"Ver as
 * N notas desta obra emitidas sem CNO"* aparece justamente no registro de NF de
 * serviço em obra sem CNO, e uma janela vazia ali deixaria a lista de cobrança
 * sem nenhuma linha exatamente na obra que mais precisa dela.
 */
export function fimDaJanelaSemCno(
  obra: Pick<Obra, "cnoRegistradoEm">,
  hoje: string,
): string {
  return obra.cnoRegistradoEm ?? hoje;
}

// ── Textos de tela com consequência fiscal (cópia do parecer) ────────────

export const TITULO_PENDENCIA_CNO = "Obra sem CNO — pendência aberta";

/**
 * **A cor da pendência de CNO — VERMELHA, e ela NÃO passa pela régua.**
 *
 * Adjudicada no Gate Fiscal do `CONTAI-042` (`contador`, 2026-09-21), quando a
 * fila unificada precisou de uma ordem entre famílias. Era `border-red` literal
 * em `app/_components/obra.tsx`; passa a ter definição única, aqui, lida pelo
 * componente e pela fila.
 *
 * ⚠️ **Não é `Gravidade` de propósito.** `gravidadeDaRegua` mede o eixo do
 * CUSTO DE AQUISIÇÃO — *"o acervo sustenta o valor no ano certo?"*. Esta
 * pendência não tem valor, não tem dispêndio e, por `CNO_NAO_MUDA_IRPF` logo
 * abaixo, **não toca o IRPF**: é obrigação acessória previdenciária, a outra
 * apuração, e as duas nunca se misturam (invariante do `CLAUDE.md`). Passada
 * pela régua ela sairia âmbar — artefato do branch default, não adjudicação.
 *
 * O vermelho é doutrinário e está fundamentado em
 * `docs/pareceres/2026-08-09-obra-sem-cno.md`: prazo legal de 30 dias (Lei
 * 8.212/91, art. 49, II) correndo contra um terceiro, dano que **acumula por
 * nota** e não começa no dia 31, e `CONSEQUENCIA_SEM_CNO_AVERBACAO` — é a
 * **única pendência do app que impede a venda**.
 */
export const COR_PENDENCIA_CNO = "red" as const;

/** Primeiro parágrafo do texto de cadastro, por estado do prazo. */
export function fraseDoPrazoCno(dataInicio: string, hoje: string): string {
  const base =
    "O CNO é obrigatório e o prazo é de 30 dias contados do início da obra " +
    "(Lei 8.212/91, art. 49).";
  const estado = estadoDataInicio(dataInicio, hoje);
  if (estado === "ausente") {
    return `${base} Informe a data real de início desta obra para o app calcular o prazo.`;
  }
  if (estado === "futura") {
    // Não pedir de novo o que já foi informado: o campo está preenchido, o que
    // está errado é o valor. `validarObra` barra este estado no salvar; aqui
    // ele ainda aparece enquanto a data é digitada na tela.
    return (
      `${base} A data de início desta obra está em ${formatarDataBR(dataInicio)}, ` +
      `no futuro — obra não começa amanhã, e é essa data que ancora o prazo do ` +
      `CNO e o período da aferição. Corrija para a data real de início.`
    );
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

// ── CONTAI-007 · o CNO impresso na nota ─────────────────────────────────

/**
 * ⚠️ **CÓPIA LITERAL do critério 2 do CONTAI-007** — não reescrever aqui.
 *
 * A MESMA frase serve aos DOIS desfechos, e a repetição é do ticket, não
 * descuido: o bloqueio (critério 2, CNO de outra obra) e a pendência
 * (critério 3, a nota não traz CNO) têm a mesma consequência fiscal. O que os
 * separa não é o dano — é se ainda há conserto: pedir a nota certa ao
 * prestador ainda é possível; reemitir a nota com o CNO da outra obra, não.
 *
 * Por que mora aqui e não na tela: o formulário, a tela do documento, a lista
 * de pendências e a lista de cobrança dizem a mesma coisa — quatro cópias
 * divergem, e a primeira coisa que diverge é a consequência fiscal.
 */
export const CONSEQUENCIA_CNO_DA_NOTA =
  "Esta nota não abate a aferição desta obra. Sem a aferição fechada não há " +
  "regularização, e sem regularização a construção não é averbada na " +
  "matrícula.";

/**
 * O que o bloqueio do critério 2 **não** destrói, e dizer isso é parte da
 * regra (Gate Fiscal, 4ª condição): são DUAS apurações distintas. O que se
 * recusa é o registro nesta obra, nunca o custo — a saída é registrar na obra
 * do CNO impresso (pre-mortem 2), e não desistir da nota.
 */
export const CNO_NAO_ALCANCA_O_CUSTO =
  "A nota continua sendo documentação hábil para o custo de aquisição no " +
  "IRPF — o que ela não faz é reduzir a base de INSS de uma obra que ela não " +
  "referencia.";

/** Critério 4 — a ação óbvia da pendência de CNO ausente. */
export const ACAO_NOTA_SEM_CNO = "pedir nota com o CNO ao prestador";

/**
 * ⚠️ **CÓPIA LITERAL do parecer de 2026-09-20, §5** — o aviso que SUBSTITUIU os
 * dois `motivo` de recusa de `podeCorrigirObra`. Não reescrever.
 *
 * As duas frases fazem trabalho diferente e nenhuma é enfeite: a primeira diz o
 * que se perde (a aferição, nas DUAS obras, até reemissão/retificação); a
 * segunda diz o que **não** se perde — e é ela que impede a leitura de que
 * mover a nota estraga o custo de aquisição, que é justamente o medo que fazia
 * a versão anterior bloquear.
 *
 * ⚠️ O parecer anota que a segunda frase "reusa `CNO_NAO_ALCANCA_O_CUSTO`", e
 * ela reusa a IDEIA, não a string: aquela constante fala da tela de REGISTRO
 * ("a nota continua sendo documentação hábil…"), esta fala da obra de DESTINO
 * de um move. Concatenar as duas produziria uma terceira frase, que não é a que
 * o parecer escreveu — e a regra do projeto é copiar o parecer, não montá-lo.
 * `CNO_NAO_ALCANCA_O_CUSTO` continua viva na tela de registro, onde nasceu.
 */
export const AVISO_CNO_NA_CORRECAO_DE_OBRA =
  "Esta NF de serviço não referencia o CNO da obra de destino. A nota não " +
  "abate a aferição de nenhuma das duas obras até que a empreiteira reemita a " +
  "nota ou retifique a EFD-Reinf com o CNO correto — mas o custo de aquisição " +
  "segue registrado normalmente na obra para onde você a está movendo.";

/** Banner da lista de cobrança — texto do mock do CONTAI-003, tela 14. */
export const COBRANCA_SEM_CNO_INSTRUCAO =
  "Notas de serviço desta obra emitidas enquanto ela não tinha CNO. Peça " +
  "retificação da EFD-Reinf de cada uma antes de liberar a próxima parcela.";

/**
 * ⚠️ O limite da alavanca, e ele é o motivo de a lista existir (critério 8):
 * *"é o único item deste lote que recupera valor em vez de só registrar
 * perda, e vale só enquanto houver parcela a liberar"*.
 */
export const COBRANCA_SEM_CNO_LIMITE =
  "O app gera a lista, como gera a discriminação anual. Ele não envia " +
  "mensagem, não guarda conversa e não acompanha status — a cobrança é sua, e " +
  "a força para fazê-la acaba no último pagamento.";

/** Uma linha da lista de cobrança (tela 14 do mock do CONTAI-003). */
export interface NotaSemCno {
  id: string;
  numero: string | null;
  dataEmissao: string;
  prestador: string | null;
  valorCentavos: number | null;
}

/**
 * **Critério 8** — as NF de serviço daquela obra emitidas DENTRO da janela sem
 * CNO: do início da obra até o registro do CNO (ou até hoje, se ele ainda não
 * saiu). São elas que se cobra da empreiteira, uma a uma, antes de liberar a
 * próxima parcela.
 *
 * ⚠️ **Só NF de serviço.** Material não tem retenção de 11% nem entra em
 * EFD-Reinf; cobrar retificação de nota de material é ruído, e ruído fabrica
 * cegueira ao aviso.
 *
 * ⚠️ **Nota sem `dataEmissao` fica de fora**, e a ausência já está dita ao
 * Mateus: é literalmente a segunda consequência de
 * `PENDENCIA_IDENTIFICACAO_EFEITO` (CONTAI-004) — *"e ela fica de fora da lista
 * de cobrança do CNO"*. Sem a data não há como afirmar que ela caiu na janela,
 * e listar por suposição seria cobrar a nota errada.
 *
 * ⚠️ A nota que **afirma trazer o CNO desta obra** sai da lista: não há o que
 * retificar nela. Hoje isso quase não acontece (dentro da janela o CNO ainda
 * não existia para ser impresso), mas a regra é do dado, não do calendário — e
 * o dia em que o CNO da obra for corrigido, é ela que mantém a lista honesta.
 *
 * ⚠️ **Nota em QUARENTENA sai da lista** — alinhado no Gate 2 do CONTAI-007 com
 * as outras duas funções que decidem sobre NF de serviço (`posicaoDeAfericao` e
 * a pendência `nf_servico_sem_cno` do `resumo.ts`), que já a excluíam. Três
 * funções discordando sobre a mesma nota é como uma delas vira a exceção que
 * ninguém lembra. E o mérito acompanha a consistência: a nota em quarentena
 * está fora do CPF do dono, e o que se pede ao prestador ali é **a nota
 * refeita no CPF certo** — pedido que a pendência de quarentena já faz. Cobrar
 * retificação de EFD-Reinf de uma nota que vai ser reemitida inteira é o
 * segundo pedido sobre o mesmo papel, e o errado dos dois.
 */
export function notasEmitidasSemCno(entrada: {
  obra: Pick<Obra, "cno" | "dataInicioObra" | "cnoRegistradoEm">;
  documentos: readonly Documento[];
  hoje: string;
}): NotaSemCno[] {
  const { obra, documentos, hoje } = entrada;
  const fim = fimDaJanelaSemCno(obra, hoje);
  const daObra = cnoNormalizado(obra.cno);

  return documentos
    .filter((d) => d.tipo === "nf_servico")
    .filter((d) => d.status !== "quarentena")
    .filter((d) => d.dataEmissao !== null)
    .filter((d) => d.dataEmissao! >= obra.dataInicioObra && d.dataEmissao! <= fim)
    .filter(
      (d) =>
        !(
          d.notaTrazCno === true &&
          daObra !== null &&
          cnoNormalizado(d.cnoReferenciado) === daObra
        ),
    )
    .map((d) => ({
      id: d.id,
      numero: d.numero,
      dataEmissao: d.dataEmissao as string,
      prestador: d.favorecidoNome,
      valorCentavos: d.valorCentavos,
    }))
    .sort((a, b) => a.dataEmissao.localeCompare(b.dataEmissao));
}

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

// ── Custo do terreno: MUDOU DE ARQUIVO no CONTAI-010 ────────────────────
//
// ⚠️ `custoTerrenoCentavos(obra)` MORREU aqui, junto com as colunas
// `valor_terreno`, `valor_itbi` e `valor_escritura_registro` (migration 0008).
// Ele somava três escalares SEM DATA e o resultado era injetado inteiro em TODO
// ano — mas custo de aquisição é regime de caixa: cada componente cai no ano da
// SUA data de pagamento.
//
// O substituto é `custoTerrenoAteOAno(desembolsos, informes, ano)`, em
// `lib/fiscal/terreno.ts`. A troca não era adiável: dropar as colunas quebra o
// build sem ela, e ela É a correção fiscal que motivou o CONTAI-010.

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

/**
 * ⚠️ **O ramo `{ permitido: false; motivo: string }` FOI APAGADO** em
 * 2026-09-20, e o apagamento é a proteção (parecer
 * `2026-09-20-cno-nao-bloqueia-correcao-de-obra.md`).
 *
 * Deixá-lo no tipo "para o dia em que precisar" manteria de pé a forma inteira
 * da recusa — um `motivo`, um `Banner` vermelho e um botão desabilitado a um
 * `if` de distância — e foi por reuso silencioso desta função que o bloqueio
 * entrou da primeira vez. **Agora o compilador recusa a recusa**: quem quiser
 * reintroduzi-la tem de reabrir este tipo, e reabrir este tipo é onde este
 * comentário está esperando.
 *
 * `permitido: true` fica como literal, e não sai: os chamadores o leem, e é
 * ele que declara, na assinatura, que esta função **não barra**.
 */
export type ResultadoCorrecaoObra = { permitido: true; aviso: string | null };

/**
 * ⚠️ **A ÚNICA regra de comparação de CNO do sistema** — exportada desde o Gate
 * 2 do CONTAI-007, quando `lib/fiscal/afericao.ts` nasceu com uma cópia dela.
 *
 * Duas cópias de "o que conta como o mesmo CNO" divergem no dia em que só uma
 * for ajustada — e aqui divergir significa uma nota abatendo a aferição numa
 * função e não abatendo na outra, pelo mesmo par de números. Quem compara CNO
 * importa daqui.
 *
 * O CNO é impresso com pontos e barra (`12.345.67890/26`); só os dígitos
 * identificam. String sem dígito nenhum é ausência, não um CNO vazio.
 */
export function cnoNormalizado(cno: string | null): string | null {
  if (!cno) return null;
  const digitos = cno.replace(/\D/g, "");
  return digitos === "" ? null : digitos;
}

/**
 * ⚠️ **O CNO NÃO BLOQUEIA A CORREÇÃO DE OBRA, E ISSO É REGRA FISCAL** — parecer
 * `docs/pareceres/2026-09-20-cno-nao-bloqueia-correcao-de-obra.md`, que é a
 * autoridade vigente sobre este ponto e reafirma o de 2026-08-23 (§2).
 *
 * ⚠️ **Esta função JÁ RECUSOU por divergência de CNO, e a recusa estava
 * fiscalmente errada.** Quem quiser reintroduzir o bloqueio tem de **citar e
 * enfrentar** os dois pareceres acima — não reabri-lo por reuso silencioso
 * desta função, que foi exatamente como ele entrou (Gate Fiscal do CONTAI-008,
 * 24/08, respondido dentro da tabela de um ticket, sem parecer transcrito e sem
 * citar o parecer de 23/08 que já tinha decidido o contrário).
 *
 * **Por que não bloqueia** (parecer de 20/09, §§1-3):
 * - o CNO amarra valor à **aferição do INSS**, nunca o dispêndio ao **bem** no
 *   sentido do art. 17 da IN SRF 84/2001. São as duas apurações do `CLAUDE.md`,
 *   e uma função só não serve às duas com a mesma régua;
 * - recusar tranca o custo de aquisição **no imóvel errado, para sempre**, sem
 *   escape no produto — e a DAA segue descrevendo um bem que não recebeu o
 *   gasto. Dano certo e imediato, em troca de nada;
 * - **a trava real já existe e é outra**: `posicaoDeAfericao`
 *   (`lib/fiscal/afericao.ts`) segrega a base pelo **CNO impresso**, não pelo
 *   `obra_id`. Mover a nota não a faz abater a aferição de lugar nenhum: ela
 *   continua fora, pelo mesmo motivo (`cno_divergente`), nas duas obras. O
 *   bloqueio aqui não protegia nada que aquela função não proteja sozinha.
 *
 * ⚠️ **O critério 2 do CONTAI-007 continua sendo BLOQUEIO, e não é contradição**
 * (parecer §4): lá é REGISTRO NOVO, onde recusar só custa escolher a obra certa
 * na hora e nenhum custo se perde. Aqui é documento já lançado.
 *
 * `null` (registro anterior ao ticket, NF de material) sempre foi permitido com
 * aviso — agora os três ramos de divergência são a mesma família.
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

  // Os DOIS ramos que recusavam. Mesma consequência, mesmo aviso: o que muda
  // entre "o destino não tem CNO" e "o destino tem outro CNO" não altera nada
  // do que o Mateus precisa saber nem do que ele precisa fazer.
  if (noDestino === null || naNota !== noDestino) {
    return { permitido: true, aviso: AVISO_CNO_NA_CORRECAO_DE_OBRA };
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
  /**
   * CONTAI-010, critério 2 — a bifurcação: é ela que decide qual regra roda.
   *
   * ⚠️ `null` é estado ACEITO e não gera erro em `validarObra` (critério 23): a
   * obra que já existe vira pendência de COMPLEMENTO, nunca bloqueio. Exigir a
   * resposta aqui travaria a edição de toda obra cadastrada antes do ticket —
   * e o app não pode devolver o Mateus para a planilha por causa de um campo
   * que ele ainda não tinha como ter respondido.
   */
  naturezaAquisicaoTerreno: NaturezaAquisicaoTerreno | null;
  unidadesAutonomas: number | null;
  origemDesmembramentoLoteamento: boolean | null;
}

export interface ErroCampoObra {
  campo: keyof EntradaObra;
  mensagem: string;
}

export function validarObra(
  entrada: EntradaObra,
  hojeIso: string,
): ErroCampoObra[] {
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
  } else if (entrada.dataInicioObra > hojeIso) {
    // Mesma trava da data de pagamento, e pelo mesmo motivo: data futura aqui
    // não é só cosmética — ela empurra o vencimento do CNO para frente (o
    // atraso real some da tela) e desloca o período que a aferição enxerga.
    erros.push({
      campo: "dataInicioObra",
      mensagem:
        "Data no futuro — obra não começa amanhã, e é esta data que ancora o prazo do CNO e o período da aferição. Informe a data real de início.",
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

  // ⚠️ `naturezaAquisicaoTerreno` NÃO é validada aqui, e a ausência da
  // validação é a decisão (critério 23): obra sem a resposta é pendência de
  // complemento, visível na tela do terreno, e continua salvável. Os valores do
  // terreno também saíram daqui — eles agora são desembolsos DATADOS, cada um
  // com a sua tela e a sua data (migration 0008).

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
