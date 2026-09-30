/**
 * COMPROMISSO — a previsão de pagamento (CONTAI-019). Módulo puro: nada de
 * rede, nada de UI.
 *
 * Fonte normativa, e nada aqui é inferido:
 * `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md` (§§1-7,
 * ADENDO 1 §§A-E, ADENDO 2 §§1-7 e §§F.1-F.5).
 *
 * ⚠️ **POR QUE ESTE ARQUIVO EXISTE, E POR QUE NÃO É UM TRECHO DE
 * `pagamento.ts`** (parecer §2):
 *
 *     "Compromisso não é custo, e não é custo 'ainda pequeno' — é zero. [...]
 *     A proteção tem de ser de TIPO, não de atenção. Registro com data
 *     anulável transforma a regra em 'todo cálculo lembra de filtrar nulo' — é
 *     o defeito do `status` com outro rosto. Um cálculo escrito daqui a seis
 *     meses não pode ter como pegar um compromisso por engano."
 *
 * Consequências que valem para quem for mexer aqui:
 *
 * 1. **Nada deste arquivo é importado por `resumo.ts` ou por `vinculo.ts`.**
 *    A dependência é de mão única: compromisso pode olhar pagamento; cálculo
 *    de custo não olha compromisso. `alocarCusto` não tem nó de compromisso
 *    (§2, item 7), e `calcularResumo` não recebe compromisso por parâmetro
 *    nenhum (critério 3) — há teste de tipo afirmando as duas coisas.
 * 2. **Nenhuma função aqui devolve dinheiro que possa ser somado a custo.**
 *    O que sai daqui é decisão de branch, lista de compromissos, saldo devido
 *    e texto. `valor previsto` nunca se chama "valor" (Gate Fiscal 6.3).
 * 3. **Nenhuma função aqui cria vínculo** (critério 41): a sugestão de
 *    quitação sugere e nada mais. "Proibido inferir vínculo por heurística" —
 *    vínculo inferido errado infla custo em silêncio E mata o alerta (§5.5 do
 *    parecer de 17/08).
 */

import type {
  Compromisso,
  Documento,
  MeioPagamento,
  Pagamento,
  SituacaoCompromisso,
  TerrenoDesembolso,
} from "@/lib/types";
import { centavosParaInput, formatarBRL, parseValorInput } from "@/lib/money";
// ⚠️ ÚNICA dependência deste arquivo em `documento.ts`, e ela é de PREDICADO:
// "sem arquivo" tem uma definição só no sistema (pre-mortem 1 do CONTAI-033).
import { faltaOArquivo, ROTULO_DO_TIPO } from "./documento";
import {
  pagosSemComprovante,
  totalPagoSemComprovanteCentavos,
} from "./terreno";
// ⚠️ CONTAI-080 — `podeVincular` entra aqui como VALOR, e não só como tipo: a
// guarda de obra do pré-vínculo é a MESMA do vínculo formal, reaproveitada
// (`podePreVincular`). A direção continua de mão única — `vinculo.ts` não
// importa nada daqui, e o teste-trava de `resumo.test.ts` afirma isso.
import { podeVincular, type Permissao } from "./vinculo";

// ── Data: utilitários locais (ISO yyyy-mm-dd compara lexicograficamente) ──

const MS_DIA = 24 * 60 * 60 * 1000;

/**
 * ⚠️ **dd/MM/aaaa, sempre** — ADENDO 3 §G.2, `[Certain]`, e vale para TODO
 * texto de tela deste parecer que exiba data:
 *
 *     "A razão não é estética: o invariante central do produto é regime de
 *     caixa — a data do pagamento DECIDE O EXERCÍCIO. Data sem ano num sistema
 *     assim é defeito onde quer que apareça [...] Perguntar 'quita o
 *     agendamento de 28/12?' na tela de janeiro é esconder do usuário
 *     exatamente o dado que ele precisa para responder."
 *
 * Não existe helper de dd/MM neste módulo, e é de propósito: para voltar a
 * omitir o ano seria preciso escrever um.
 */
function dataBR(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Dias de `a` até `b` (positivo quando `b` é depois). */
function diasEntre(a: string, b: string): number {
  const ta = Date.parse(`${a}T00:00:00Z`);
  const tb = Date.parse(`${b}T00:00:00Z`);
  return Math.round((tb - ta) / MS_DIA);
}

// ── O branch do registro (critérios 4, 5, 6, 25, 26, 27) ─────────────────

/**
 * Para onde vai o que o Mateus acabou de digitar.
 *
 * ⚠️ **Cartão não passa por aqui** (CONTAI-022): a compra no cartão nasce
 * compromisso sempre, com `data_prevista` = vencimento da fatura — decisão
 * tomada no formulário PRÓPRIO da compra (`lib/fiscal/fatura.ts`), nunca
 * pela regra `data ≤ hoje` deste arquivo. Confirmado pelo `contador`: a
 * recusa total de `meio=cartao` (`RECUSA_CARTAO`, CONTAI-019) saiu de cena
 * por completo depois que o fluxo da fatura abriu — não há mais caminho de
 * código chamando `decidirRegistro` com `meio="cartao"`, e por isso o tipo
 * não aceita mais esse valor.
 */
export type Destino = { tipo: "pagamento" } | { tipo: "compromisso" };

/**
 * ⚠️ **A DATA É O CONTROLE** (diretriz de desenho 1): sem segmented control
 * "já paguei / vou pagar", que seria um toque a mais no caminho de 95%.
 */
export function decidirRegistro(
  entrada: { meio: Exclude<MeioPagamento, "cartao">; data: string },
  hojeIso: string,
): Destino {
  return entrada.data <= hojeIso ? { tipo: "pagamento" } : { tipo: "compromisso" };
}

// ── Vencido sem resposta e o bloqueio anual (critérios 20, 21, 21b, 21c) ──

/**
 * Vencido sem resposta: aberto, com data prevista, e a data já passou.
 *
 * **Nunca some e nunca expira sozinho** (critério 20, parecer §3): "sumiço
 * silencioso devolve o compromisso para a cabeça dele, que é a falha da meta 1
 * pelo lado de fora". Não há janela, não há prazo — 90 dias depois continua
 * aqui, do mesmo jeito.
 *
 * `dataPrevista === null` **não é vencido** (critério 21b): incerteza
 * declarada não é silêncio.
 */
export function ehVencidoSemResposta(
  c: Pick<Compromisso, "situacao" | "dataPrevista">,
  hojeIso: string,
): boolean {
  if (c.situacao !== "aberto") return false;
  if (c.dataPrevista === null) return false;
  return c.dataPrevista < hojeIso;
}

/**
 * Os compromissos que travam a geração de relatório anual, agora.
 *
 * Desbloqueiam, e sempre existe uma disponível — o bloqueio nunca é uma prisão
 * (critério 21c, adendo §A corolário 2):
 * - **saiu** → cria pagamento, o compromisso vira `quitado`;
 * - **não saiu** → `cancelado` com motivo;
 * - **mudou a data** → nova data prevista (o mesmo compromisso, com histórico).
 *
 * **NÃO desbloqueia** o *"não, é outro pagamento"* da sugestão de quitação
 * (adendo §A, corolário 4): recusar um par não responde nada sobre o
 * compromisso.
 */
export function compromissosQueBloqueiam(
  cs: readonly Compromisso[],
  hojeIso: string,
): Compromisso[] {
  return cs.filter((c) => ehVencidoSemResposta(c, hojeIso));
}

// ══ A PORTA ÚNICA DAS SAÍDAS ANUAIS ═════════════════════════════════════
//
// ⚠️ **"A porta é única; o veto é por saída."** — reconciliação entre o
// `contador` e o `cto-obra` no CONTAI-036, critério 8. Duas coisas, e elas não
// se contradizem:
//
// 1. **Porta única no MECANISMO.** Continua existindo uma função só que decide
//    se uma saída anual pode nascer. Uma segunda função "que também decide" é
//    exatamente como a **D47** nasceu: a chamada passaria por uma e não pela
//    outra, e a guarda ficaria satisfeita **por vacuidade**.
// 2. **Veto por SAÍDA no resultado.** O que sai da porta não é mais um booleano
//    só: são **três blocos independentes**, um por saída anual, cada um com
//    **marca própria**. `bensEDireitos` carrega o termo do terreno; os outros
//    dois, não.
//
// ⚠️ **A destravagem do critério 16 NÃO foi um `delete`.** A guarda da fatia 1
// (`bloqueioDaSaidaAnual` / `motivoDoBloqueioDaSaidaAnual`) existia para impedir
// que a discriminação saísse com um total que não dissesse o que deixou de
// fora. Ela não foi apagada: virou **obrigação tipada**. Quem gera Bens e
// Direitos recebe o número do §4.5 **dentro da marca**, e não tem como
// renderizar a ficha sem tê-lo em mãos — pre-mortem 1 do CONTAI-036:
//
//     "Alguém apaga a guarda e escreve a tela; a linha do §4.5 vira uma <div>
//     que o próximo refactor remove sem nada ficar vermelho. Por isso a
//     obrigação mora no RETORNO TIPADO da porta, não na boa vontade de quem
//     escreve JSX."

/**
 * A marca. **`declare const`**: existe só no tipo, nunca em runtime — não há
 * valor a importar, e por isso não há como um módulo de fora montar um objeto
 * que a satisfaça sem escrever um `as` explícito, que é greppável.
 */
declare const MARCA_DA_SAIDA: unique symbol;

/**
 * §4.5 — o que ficou **fora do custo confirmado por falta de comprovante**.
 *
 * ⚠️ Mora **dentro** da marca de `bensEDireitos`, e não ao lado dela, porque é
 * assim que a linha do §4.5 deixa de ser opcional: quem tem a marca tem o
 * número, e quem não tem a marca não gera a ficha.
 */
export interface ForaDoCustoConfirmado {
  quantidade: number;
  totalCentavos: number;
}

/**
 * Marca da **discriminação de Bens e Direitos**. Único bloco que carrega o
 * termo do terreno (critério 8): desembolso de terreno pago sem comprovante
 * não tem CPF a listar nem base de retenção a reduzir.
 */
export interface LiberadoBensEDireitos {
  readonly [MARCA_DA_SAIDA]: "bensEDireitos";
  readonly ano: number;
  readonly foraDoCustoConfirmado: ForaDoCustoConfirmado;
}

/** Marca da ficha **Pagamentos Efetuados**. Sem termo de terreno — critério 8. */
export interface LiberadoPagamentosEfetuados {
  readonly [MARCA_DA_SAIDA]: "pagamentosEfetuados";
  readonly ano: number;
}

/** Marca da posição da **aferição INSS (SERO)**. Sem termo de terreno. */
export interface LiberadoAfericaoInss {
  readonly [MARCA_DA_SAIDA]: "afericaoInss";
  readonly ano: number;
}

/**
 * ⚠️ **RESIDUAL 1 do CONTAI-025, e ele fecha por TIPO** (critério 10).
 *
 * Antes deste ticket, `podeGerarRelatorioAnual(cs, hoje, ano, [])` typechecava
 * e devolvia `ok: true` — a guarda do terreno sumia sem ninguém apagar nada,
 * porque um literal vazio é um argumento perfeitamente válido. O tipo era
 * `readonly TerrenoDesembolso[]`, e "nenhum desembolso" e "não fui buscar os
 * desembolsos" **têm a mesma forma**.
 *
 * Agora não têm. Este tipo é **opaco** e só a camada de dados o produz
 * (`lib/dados/saida-anual.ts`). O literal `[]` deixa de compilar, e há teste
 * com `@ts-expect-error` afirmando isso.
 */
declare const MARCA_DOS_DESEMBOLSOS: unique symbol;

export interface DesembolsosDoTerrenoCarregados {
  readonly [MARCA_DOS_DESEMBOLSOS]: true;
  readonly lista: readonly TerrenoDesembolso[];
}

/**
 * ⚠️ **O ÚNICO ponto do sistema que produz `DesembolsosDoTerrenoCarregados`.**
 * Mora aqui, e não em `lib/dados`, para o tipo e o construtor nascerem juntos;
 * quem o chama é a **porta composta** (`lib/dados/saida-anual.ts`), e a
 * blindagem de `terreno.test.ts` proíbe `app/` de chamá-lo.
 *
 * Não é cerimônia: é a diferença entre "a obra não tem desembolso" e "esqueci
 * de buscar os desembolsos", que o `[]` colapsava.
 */
export function desembolsosCarregados(
  lista: readonly TerrenoDesembolso[],
): DesembolsosDoTerrenoCarregados {
  return { lista } as DesembolsosDoTerrenoCarregados;
}

/**
 * ⚠️ **CONTAI-033, critério 11 — o MESMO desenho, pelo mesmo motivo.**
 *
 * A guarda de superfície da pendência "Nota sem arquivo" precisa dos documentos
 * da obra, e `readonly Documento[]` colapsaria outra vez "esta obra não tem
 * documento" com "não fui buscar os documentos" — só que agora o colapso
 * libera a **saída anual** com nota afirmada de memória em pé, que é o buraco
 * D47 que o parecer ADENDO 1 §A.5 nomeia: *"quatro superfícies gravando e
 * nenhuma cobrando é trocar 'não registra' por 'registra e esquece'"*.
 *
 * Marca opaca, `declare const`, e o único produtor é `documentosCarregados`.
 * `carregarPainel` já traz `documentos` — nenhuma query nova.
 */
declare const MARCA_DOS_DOCUMENTOS: unique symbol;

export interface DocumentosCarregados {
  readonly [MARCA_DOS_DOCUMENTOS]: true;
  readonly lista: readonly Documento[];
}

/**
 * ⚠️ **O ÚNICO ponto do sistema que produz `DocumentosCarregados`.** Mesma
 * regra do irmão acima: quem o chama é a porta composta
 * (`lib/dados/saida-anual.ts`), com `documentosCarregados(painel.documentos)`.
 */
export function documentosCarregados(
  lista: readonly Documento[],
): DocumentosCarregados {
  return { lista } as DocumentosCarregados;
}

/**
 * ⚠️ **O PORTÃO TRANSVERSAL — crit. 21 do CONTAI-019, e ele NÃO migra.**
 *
 * Compromisso vencido sem resposta veta **as três** saídas, e não só a de Bens
 * e Direitos. O `contador` foi explícito no Gate Fiscal do CONTAI-036:
 *
 *     "a incerteza dele pode virar qualquer um dos três tipos de saída" — um
 *     vencido sem resposta pode virar pagamento a PF (Pagamentos Efetuados) ou
 *     serviço PJ com retenção (aferição), além de custo.
 *
 * Por isso ele fica **acima** dos três blocos, e não dentro de um deles.
 */
export type PermissaoRelatorio =
  | {
      /** Nenhuma das três sai: o portão transversal está fechado. */
      ok: false;
      faltamResponder: Compromisso[];
    }
  | {
      /**
       * ⚠️ **CONTAI-033, critério 11** — nenhuma das três sai enquanto existir
       * documento com `arquivo_path IS NULL`.
       *
       * Braço PRÓPRIO, e não um campo a mais no de cima: são dois vetos com
       * causas diferentes e remédios diferentes (responder um agendamento ×
       * subir o arquivo da nota), e a tela diz qual dos dois é.
       *
       * Veta **as três** saídas, como o portão transversal, e pelo mesmo tipo
       * de razão: a nota afirmada de memória pode virar custo (Bens e Direitos),
       * pagamento a PF (Pagamentos Efetuados) ou serviço PJ com retenção
       * (aferição) — e enquanto o papel não chega, nenhuma das três hipóteses
       * tem lastro.
       */
      ok: false;
      semArquivo: Documento[];
    }
  | {
      ok: true;
      bensEDireitos: LiberadoBensEDireitos;
      pagamentosEfetuados: LiberadoPagamentosEfetuados;
      afericaoInss: LiberadoAfericaoInss;
    };

/**
 * ⚠️ **O DENTE DO MECANISMO — critério 21.** É o único ponto do sistema que
 * obriga resposta, e é na virada do ano que a omissão custa.
 *
 * ⚠️ **`ano` NÃO RECORTA NADA, e está na assinatura de propósito.** Decisão do
 * `contador` no adendo §A, `[Certain]`:
 *
 *     "Qualquer compromisso vencido sem resposta bloqueia a geração de
 *     QUALQUER relatório anual, e não apenas o do ano em que cai a data
 *     prevista. [...] A data prevista é uma previsão, e previsão não decide
 *     nada fiscal — é a espinha deste parecer inteiro. Deixar a previsão
 *     recortar o bloqueio é devolver à previsão um efeito fiscal, com outro
 *     rosto."
 *
 * O caso real prova a regra: previsto para 28/12/2025, pago de fato em
 * 05/01/2026. Enquanto ele estiver sem resposta, **ninguém sabe se aquele
 * desembolso pertence a 2025 ou a 2026** — as duas hipóteses estão vivas ao
 * mesmo tempo. Recortando por ano, o relatório de 2026 sairia liberado com um
 * desembolso possivelmente dele, não registrado, e sem ninguém perguntar nada.
 *
 * O parâmetro **entra no payload** das três marcas (é ele que diz de que ano é
 * a saída), e continua sem recortar o veto — há teste afirmando as duas coisas.
 *
 * Sobre-bloqueio consciente (corolário 5): gerar o relatório de 2025 em 2027
 * com um compromisso de 2026 vencido e sem resposta também trava. É
 * deliberado — o custo é um toque, e a resposta é justamente o dado que decide
 * o ano.
 *
 * ⚠️ **O termo do terreno NÃO recorta por ano tampouco**: um desembolso pago
 * sem comprovante em qualquer ano entra na linha do §4.5, porque o sem data não
 * tem ano-calendário e o com data pode ter o ano corrigido depois. É o mesmo
 * agregado do card da home (decisão de design 2 do mock).
 */
export function podeGerarRelatorioAnual(
  cs: readonly Compromisso[],
  hojeIso: string,
  ano: number,
  desembolsosTerreno: DesembolsosDoTerrenoCarregados,
  documentos: DocumentosCarregados,
): PermissaoRelatorio {
  const faltamResponder = compromissosQueBloqueiam(cs, hojeIso);
  if (faltamResponder.length > 0) return { ok: false, faltamResponder };

  // ⚠️ CONTAI-033, critério 11 — DEPOIS do portão transversal e ANTES do resto:
  // o veto do CONTAI-019 continua com precedência, porque a resposta de um
  // agendamento vencido é o dado que decide o ANO, e sem ele nem se sabe a que
  // relatório o valor pertence.
  //
  // Predicado só `arquivo_path IS NULL`, sem olhar `status` (confirmação do
  // `contador`, 2026-09-19): quarentena sem arquivo também veta.
  const semArquivo = documentos.lista.filter(faltaOArquivo);
  if (semArquivo.length > 0) return { ok: false, semArquivo };

  const pendentes = pagosSemComprovante(desembolsosTerreno.lista);
  return {
    ok: true,
    bensEDireitos: {
      ano,
      foraDoCustoConfirmado: {
        quantidade: pendentes.length,
        totalCentavos: totalPagoSemComprovanteCentavos(desembolsosTerreno.lista),
      },
    } as LiberadoBensEDireitos,
    pagamentosEfetuados: { ano } as LiberadoPagamentosEfetuados,
    afericaoInss: { ano } as LiberadoAfericaoInss,
  };
}

// ── As quatro marcas e o bloco da home (critérios 8, 8b, 42, 43) ─────────

/**
 * A PREPOSIÇÃO DE TEMPO — a quarta das quatro marcas do critério 8, e a única
 * que é texto.
 *
 * Diretriz de desenho 3: **a preposição carrega o tempo**. *"pago em 05/08/2026"*
 * (fato) × *"para 15/09/2026"* (previsão) × *"era para 10/08/2026"* (previsão
 * que não se cumpriu). É ela que impede o cartão de um agendado ser lido como
 * pagamento — e ler agendado como pago é o que faz o Mateus registrar o mesmo
 * PIX duas vezes.
 *
 * Data com ANO, sempre (ADENDO 3 §G.2).
 */
export function preposicaoDeTempo(c: Compromisso, hojeIso: string): string {
  if (c.dataPrevista === null) return "sem data definida";
  return ehVencidoSemResposta(c, hojeIso)
    ? `era para ${dataBR(c.dataPrevista)}`
    : `para ${dataBR(c.dataPrevista)}`;
}

/** Há quantos dias venceu sem resposta. Zero para o que não venceu. */
export function diasSemResposta(c: Compromisso, hojeIso: string): number {
  if (!ehVencidoSemResposta(c, hojeIso)) return 0;
  return diasEntre(c.dataPrevista!, hojeIso);
}

/**
 * A URGÊNCIA de um agendamento — CONTAI-075, critério 6.
 *
 * ⚠️ **Substituiu o `forte: boolean`, e não convive com ele.** O booleano tinha
 * dois valores para o que hoje são quatro estados, e o app só reagia DEPOIS do
 * vencimento: um pagamento que vence amanhã era pintado igual a um que vence em
 * 30 dias. Trocar o tipo (em vez de acrescentar um campo ao lado) é o que faz o
 * TypeScript recusar um consumidor que tenha ficado para trás — a mitigação do
 * pre-mortem 1 do ticket.
 *
 * ⚠️ **Isto NÃO é escala de gravidade fiscal**, e o Gate Fiscal do CONTAI-075 é
 * explícito: `vence_hoje`/`vence_amanha` existem só para `dataPrevista` hoje ou
 * no futuro, nada saiu da conta e **nenhum dos dois promete consequência
 * nenhuma**. O bloqueio de relatório anual continua sendo exclusivo do
 * `"vencido"`, decidido por `ehVencidoSemResposta` e por mais ninguém.
 *
 * ⚠️ **Nenhum valor daqui carrega cor ou classe de CSS.** O mapa
 * urgência→peso visual mora na camada de UI (`pesoDoChip`, em
 * `app/_components/agendado.tsx`): lib fiscal não decide borda.
 */
export type UrgenciaDoAgendamento =
  | "comum"
  | "vence_amanha"
  | "vence_hoje"
  | "vencido";

/**
 * O CHIP — a segunda das quatro marcas, e o eixo do critério 8b.
 *
 * ⚠️ **Vencido NÃO se distingue de aberto pela borda** (decisão 2 do
 * fechamento de 18/08): a tracejada fica nos DOIS. Distinguem três outras
 * coisas ao mesmo tempo, e esta função entrega duas delas:
 * 1. `urgencia` — o peso do chip, do âmbar vazado ao âmbar **preenchido**;
 * 2. o texto **nomeia o vencimento e o silêncio**, contra um "Agendado" mudo.
 * A terceira é estrutural e mora na tela: as três respostas existem DENTRO do
 * cartão do vencido e **não existem** no aberto.
 *
 * "Precisando de mais peso, engrossa-se a tracejada, nunca se troca o estilo."
 *
 * ⚠️ **A ORDEM DE CHECAGEM É REQUISITO** (CONTAI-075, critério 11): o vencido
 * vem PRIMEIRO. Hoje `ehVencidoSemResposta` usa `<` estrito, então um
 * `dataPrevista === hojeIso` jamais é vencido e os dois ramos não se cruzam —
 * mas essa garantia é de OUTRA função, e um refactor lá dentro (um `<=` por
 * descuido) faria o "Vence hoje" roubar a vez do vencido, apagando da tela o
 * único estado que trava relatório anual. Perguntar pelo vencido antes torna a
 * inversão impossível daqui.
 *
 * ⚠️ **`situacao === "aberto"` guarda os dois estados novos**, e não é
 * redundância: `/compromisso/[id]` renderiza estas marcas para compromisso
 * QUITADO e CANCELADO também, e um quitado cuja data prevista caía hoje diria
 * "Vence hoje" sobre dinheiro que já saiu. `ehVencidoSemResposta` filtra
 * situação por dentro; aqui a filtragem tem de ser explícita.
 */
export function chipDoAgendado(
  c: Compromisso,
  hojeIso: string,
): { texto: string; urgencia: UrgenciaDoAgendamento } {
  // ── 1 · VENCIDO, antes de qualquer coisa (critério 11) ─────────────────
  if (ehVencidoSemResposta(c, hojeIso)) {
    const dias = diasSemResposta(c, hojeIso);
    return {
      texto:
        `Venceu em ${dataBR(c.dataPrevista!)} · ` +
        `${dias} ${dias === 1 ? "dia" : "dias"} sem resposta`,
      urgencia: "vencido",
    };
  }
  // ── 2 · A janela de dois dias, do MESMO `hojeIso` (critério 10) ────────
  // Nenhuma segunda derivação de data aqui dentro: um `new Date()` próprio
  // divergiria do gate do vencido por fuso, e os dois estados passariam a
  // discordar sobre que dia é hoje.
  if (c.situacao === "aberto" && c.dataPrevista !== null) {
    const faltam = diasEntre(hojeIso, c.dataPrevista);
    if (faltam === 0) return { texto: "Vence hoje", urgencia: "vence_hoje" };
    if (faltam === 1) return { texto: "Vence amanhã", urgencia: "vence_amanha" };
  }
  // ── 3 · Tudo o mais, inclusive `dataPrevista === null` ─────────────────
  return { texto: "Agendado", urgencia: "comum" };
}

/**
 * O texto do vencido sem resposta. Copiado do que o Gate Fiscal 4 e o adendo
 * §A dizem, sem prometer nada além disso: **isto não é pendência fiscal**, e
 * mesmo assim **não some sozinho**.
 *
 * ⚠️ **Mudou de casa no CONTAI-072 (critério 9), e o texto NÃO mudou uma
 * vírgula.** Morava em `app/_components/agendado.tsx`, que é arquivo de
 * componente; `lib/fiscal/despesas.ts` é lib pura e passou a precisar dele para
 * preencher a `consequencia` da linha do agendamento vencido — lib importando
 * de `app/` é a dependência ao contrário. `agendado.tsx` reexporta a constante,
 * então nenhum consumidor existente mudou de import.
 */
export const VENCIDO_SEM_RESPOSTA =
  "Isto não é pendência fiscal: nada saiu da conta, então não há risco fiscal " +
  "ainda. Mas não some sozinho — enquanto ficar sem resposta, nenhum " +
  "relatório anual pode ser gerado, nem o deste ano nem o de outro.";

/** Critério 43 — no máximo 3 abertos na home. Vencido não tem teto. */
export const MAX_ABERTOS_NA_HOME = 3;

export interface AgendaHome {
  /** ⚠️ TODOS, sem truncar nunca — truncar vencido é o sumiço que o §3 proíbe. */
  vencidos: Compromisso[];
  /** No máximo `MAX_ABERTOS_NA_HOME`, por data prevista crescente. */
  abertos: Compromisso[];
  /** Quantos abertos existem ao todo — o N de "ver todos (N)". */
  abertosTotal: number;
  /** ⚠️ CONTAGEM, nunca soma de valores (critério 42). */
  contagem: string;
  vazia: boolean;
}

function porDataPrevista(a: Compromisso, b: Compromisso): number {
  if (a.dataPrevista !== b.dataPrevista) {
    if (a.dataPrevista === null) return 1; // sem data definida por último
    if (b.dataPrevista === null) return -1;
    return a.dataPrevista < b.dataPrevista ? -1 : 1;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * O bloco de agendados da home.
 *
 * Só entra `situacao === 'aberto'`: quitado e cancelado **saem da lista**
 * assim que respondidos (parecer §5, defesa 3) — continuar mostrando o que já
 * foi respondido é o ruído que faz parar de olhar.
 *
 * ⚠️ **A contagem NÃO é acompanhada de soma, sob rótulo nenhum** (critério 42).
 * Número em reais a centímetros do custo confirmado vira "quanto a obra tem
 * marcado" — previsão de fluxo de caixa, fora de escopo declarado. E somar
 * previsto ao lado de realizado é a soma mista que o §2, item 8, proíbe.
 */
export function montarAgendaDaHome(
  cs: readonly Compromisso[],
  hojeIso: string,
  /**
   * O corte dos abertos. `Infinity` é a tela `/compromisso` — o destino do
   * "ver todos (N)", que é justamente onde o corte da home deixa de valer.
   * Vencido nunca tem teto, aqui ou lá.
   */
  limiteAbertos: number = MAX_ABERTOS_NA_HOME,
): AgendaHome {
  const abertosTodos = cs.filter((c) => c.situacao === "aberto");
  const vencidos = abertosTodos
    .filter((c) => ehVencidoSemResposta(c, hojeIso))
    .sort(porDataPrevista);
  const naoVencidos = abertosTodos
    .filter((c) => !ehVencidoSemResposta(c, hojeIso))
    .sort(porDataPrevista);

  const partes: string[] = [];
  if (naoVencidos.length > 0) {
    partes.push(
      `${naoVencidos.length} ainda não ${naoVencidos.length === 1 ? "pago" : "pagos"}`,
    );
  }
  if (vencidos.length > 0) {
    partes.push(
      `${vencidos.length} já ${vencidos.length === 1 ? "venceu" : "venceram"}`,
    );
  }

  return {
    vencidos,
    abertos: naoVencidos.slice(0, limiteAbertos),
    abertosTotal: naoVencidos.length,
    contagem: partes.join(", "),
    vazia: abertosTodos.length === 0,
  };
}

// ── O agendamento visto DO LADO DA NOTA (CONTAI-072) ─────────────────────

/**
 * O que uma tela precisa saber para dizer que a nota hábil sem pagamento **já
 * tem plano** — e nada além disso.
 *
 * ⚠️ **Nenhum campo aqui é dinheiro somável** (regra 2 do cabeçalho deste
 * arquivo): o valor previsto só aparece DENTRO de `resumo`, já marcado como
 * previsto pela própria `resumoDoAgendamento`. Não há `centavos` nesta
 * interface, e é de propósito — quem quisesse somar previsto com o número do
 * card teria de ir buscar o valor no `Compromisso`, o que é greppável.
 */
export interface AgendamentoDoDocumento {
  /**
   * O id do compromisso ELEITO (critério 6) — pode haver mais de um aberto.
   *
   * ⚠️ Só o `id`, nunca o `Compromisso` inteiro: nenhum consumidor de
   * produção lê outro campo dele, e devolver o objeto completo exporia
   * `valorPrevistoCentavos`/`saldoDoCompromisso` para fora da barreira que
   * `resumo.ts`/`vinculo.ts` mantêm (Gate 2 do CONTAI-072) — a exceção fica
   * estreita por TIPO, não só pelo teste que proíbe o grep.
   */
  compromissoId: string;
  /**
   * ⚠️ **A ÚNICA casa para agir sobre ele** (critério 7): as três respostas
   * (`TresRespostas`) não se duplicam no card/linha da nota, moram lá.
   */
  href: string;
  /** `chipDoAgendado().texto` — reaproveitado, nunca redigido de novo. */
  chip: string;
  /**
   * `chipDoAgendado().urgencia` — CONTAI-075, critério 6: substituiu o
   * `forte: boolean`, que não sabia dizer "vence hoje".
   *
   * ⚠️ É por PESO que o chip escala, nunca por matiz: vermelho no app significa
   * "o dinheiro saiu e não está no custo", e aqui nada saiu da conta (critério
   * 4 do CONTAI-072, mesma régua de `app/_components/agendado.tsx`). Quem
   * traduz urgência em peso é `pesoDoChip`, na UI — este campo é o estado, não
   * o estilo.
   */
  urgencia: UrgenciaDoAgendamento;
  /**
   * ⚠️ **Continua existindo separado de `urgencia`, de propósito** (CONTAI-075,
   * critério 9): ele é o gate do bloqueio de relatório anual, e colapsá-lo num
   * `urgencia === "vencido"` espalharia comparação de string pelo consumidor.
   * O invariante `vencidoSemResposta === (urgencia === "vencido")` é testado.
   */
  vencidoSemResposta: boolean;
  /** `resumoDoAgendamento()` — "{favorecido} — previsto R$X para DD/MM/AAAA". */
  resumo: string;
  /**
   * `VENCIDO_SEM_RESPOSTA` no vencido; `null` no que está dentro do prazo.
   *
   * `null` é "não há nada A MAIS a dizer", e não "não há consequência": a tela
   * continua dizendo o que já dizia sobre a nota sem pagamento ligado
   * (`EXPLICACAO_NOTAS_SEM_PAGAMENTO`, que é de `vinculo.ts` e continua sendo
   * lida lá). Este campo só acrescenta o que o estado vencido acrescenta.
   */
  consequenciaExtra: string | null;
}

/**
 * A ordem de ELEIÇÃO do critério 6, quando a mesma nota tem mais de um
 * compromisso aberto (boleto parcelado é caso legítimo, não defeito):
 * qualquer vencido na frente de qualquer não vencido; entre vencidos, mais dias
 * sem resposta primeiro; entre não vencidos, data prevista mais próxima, `null`
 * por último. Desempate final por `id`, para a tela não dançar entre dois
 * carregamentos.
 */
function porPrioridadeDoAgendamento(
  a: Compromisso,
  b: Compromisso,
  hojeIso: string,
): number {
  const va = ehVencidoSemResposta(a, hojeIso);
  const vb = ehVencidoSemResposta(b, hojeIso);
  if (va !== vb) return va ? -1 : 1;
  if (va) {
    const dias = diasSemResposta(b, hojeIso) - diasSemResposta(a, hojeIso);
    if (dias !== 0) return dias;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  }
  return porDataPrevista(a, b);
}

function marcaDoAgendamento(
  c: Compromisso,
  hojeIso: string,
): AgendamentoDoDocumento {
  const chip = chipDoAgendado(c, hojeIso);
  const vencido = ehVencidoSemResposta(c, hojeIso);
  return {
    compromissoId: c.id,
    href: `/compromisso/${c.id}`,
    chip: chip.texto,
    urgencia: chip.urgencia,
    vencidoSemResposta: vencido,
    resumo: resumoDoAgendamento(c),
    consequenciaExtra: vencido ? VENCIDO_SEM_RESPOSTA : null,
  };
}

/**
 * **CONTAI-072 — o agendamento aberto de cada documento, indexado pelo
 * documento.**
 *
 * ⚠️ **Ela NÃO tira nada de lista nenhuma e NÃO devolve valor nenhum a somar**
 * (Gate Fiscal do ticket, parecer §1/§2 item 6): a nota hábil sem pagamento
 * continua inteira na lista e na soma de "Notas hábeis sem pagamento
 * vinculado", porque **compromisso não é pagamento e pode ser cancelado**. O
 * que sai daqui é TEXTO e DESTINO DE LINK — a única coisa que o ticket autoriza
 * a mudar.
 *
 * ⚠️ **`situacao === "aberto"` e só** (critério 5): quitado e cancelado não
 * marcam nada. A marca reflete o estado ATUAL do compromisso, nunca o histórico
 * de FK no banco — um agendamento cancelado deixa a nota exatamente como uma
 * nota sem rastro nenhum, que é a verdade.
 *
 * ⚠️ **Função pura, e é ela nos DOIS consumidores** (critério 10 e pre-mortem
 * 2): o painel da Visão geral cruza o resultado com `NotaSemPagamento.documentoId`
 * fora dos módulos protegidos, e `lib/fiscal/despesas.ts` a chama por dentro.
 * Duas implementações da mesma leitura divergiriam, e o ticket nasceu
 * justamente de uma tela dizendo uma coisa e a outra dizendo outra sobre a
 * mesma nota.
 *
 * Compromisso sem `documentoOrigemId` não entra: não há nota a marcar. Vínculo
 * apontando para documento de outra obra degrada para "sem compromisso" —
 * dívida conhecida e registrada, não regressão deste ticket.
 */
export function agendamentosPorDocumento(
  compromissos: readonly Compromisso[],
  hojeIso: string,
): Map<string, AgendamentoDoDocumento> {
  const eleitos = new Map<string, Compromisso>();
  for (const c of compromissos) {
    if (c.situacao !== "aberto") continue;
    if (c.documentoOrigemId === null) continue;
    const atual = eleitos.get(c.documentoOrigemId);
    if (
      atual === undefined ||
      porPrioridadeDoAgendamento(c, atual, hojeIso) < 0
    ) {
      eleitos.set(c.documentoOrigemId, c);
    }
  }

  return new Map(
    [...eleitos].map(([documentoId, c]) => [
      documentoId,
      marcaDoAgendamento(c, hojeIso),
    ]),
  );
}

// ── Saldo (critérios 15, 29 e 30) ────────────────────────────────────────

/**
 * Quanto ainda falta pagar deste compromisso.
 *
 * ⚠️ **O saldo NÃO É CUSTO DE NADA** (critério 29, adendo §D): "não é custo
 * deste ano, não é custo de ano nenhum, e só vira custo se e quando for pago".
 * Ele é dívida conhecida, e por isso a conta é sobre o VALOR CHEIO dos
 * pagamentos — o que quita o credor é o que saiu da conta, encargo incluído.
 * Custo é outra pergunta, e ela se responde em `lib/fiscal/vinculo.ts`.
 */
export function saldoDoCompromisso(
  c: Compromisso,
  pagamentos: readonly Pagamento[],
): number {
  // ⚠️ Quitado e cancelado NÃO TÊM SALDO — critério 28: "quita o compromisso"
  // fecha sem **nenhum resíduo**: sem saldo, sem pendência, sem "pago sem
  // nota" pela diferença. Quando ele diz que o pagamento menor QUITA, o que
  // sobrava deixou de ser devido; um saldo residual aqui reabriria pela
  // aritmética uma dívida que a decisão humana encerrou.
  if (c.situacao !== "aberto") return 0;
  const pago = pagamentos
    .filter((p) => c.pagamentoIds.includes(p.id))
    .reduce((s, p) => s + p.valorCentavos, 0);
  return Math.max(0, c.valorPrevistoCentavos - pago);
}

/** Quanto já saiu da conta contra este compromisso — a base da guarda abaixo. */
export function pagoDoCompromisso(
  c: Pick<Compromisso, "pagamentoIds">,
  pagamentos: readonly Pagamento[],
): number {
  return pagamentos
    .filter((p) => c.pagamentoIds.includes(p.id))
    .reduce((s, p) => s + p.valorCentavos, 0);
}

// ── Corrigir o valor previsto (CONTAI-073) ────────────────────────────────

/**
 * ⚠️ **SEM IMPACTO FISCAL, e é o `contador` quem afirma** (Gate Fiscal do
 * CONTAI-073; parecer §1: *"compromisso não é custo, e não é custo 'ainda
 * pequeno' — é zero"*). Corrigir `valor_previsto` não mexe em custo de
 * aquisição (regime de caixa — a chave é `pagamento.data_pagamento`) nem na
 * base de aferição INSS. Nada aqui abre pendência, e nada aqui entra em soma.
 *
 * O que estas guardas protegem é ESTRUTURAL, não fiscal: um valor previsto
 * menor ou igual ao que já foi pago faria `saldoDoCompromisso`
 * (`max(0, previsto − pago)`) zerar em SILÊNCIO, deixando um agendamento
 * `aberto` com saldo zero — estado que nenhuma tela do app sabe ler hoje.
 *
 * ⚠️ **Este módulo é a validação da TELA, nunca a garantia.** Quem garante é a
 * RPC `corrigir_valor_compromisso` (migration 0022), que reconfere tudo DENTRO
 * da transação: aqui não há como saber se uma quitação parcial foi gravada por
 * outra aba entre o carregamento e o clique em Salvar (pre-mortem 1 do ticket).
 * Os textos abaixo são os do spec `design/mocks/CONTAI-073.md` §5 — copiados,
 * não reescritos.
 */
export type RecusaDeCorrecaoDeValor =
  | "situacao_respondida"
  | "vazio"
  | "nao_numerico"
  | "igual_ao_atual"
  | "zero"
  | "menor_ou_igual_ao_pago"
  | "sem_motivo";

export type PermissaoCorrecaoDeValor =
  | { ok: true; valorNovoCentavos: number }
  | { ok: false; recusa: RecusaDeCorrecaoDeValor; motivo: string | null };

export const MOTIVO_VALOR_NAO_NUMERICO =
  "Não consigo ler isto como um valor em reais. Digite só números, com vírgula nos centavos.";

export const MOTIVO_VALOR_IGUAL_AO_ATUAL =
  "Igual ao valor previsto atual — não há o que corrigir.";

export const MOTIVO_VALOR_ZERO =
  'O valor previsto não pode ser zero. Se este agendamento deixou de ser real, use "Marcar que não vai ser pago" em vez de zerar o valor.';

export function motivoValorMenorOuIgualAoPago(pagoCentavos: number): string {
  return (
    `Já foi pago ${formatarBRL(pagoCentavos)} contra este agendamento. O valor ` +
    "novo tem que ser maior que isso — do contrário o saldo zeraria sem " +
    "explicação nenhuma."
  );
}

/** O mesmo texto de `cancelar/page.tsx`: motivo é campo obrigatório. */
export const MOTIVO_CORRECAO_SEM_MOTIVO =
  "Escreva o motivo — campo obrigatório.";

/**
 * A precedência do spec §5, na ordem exata: a primeira que bater é a que a tela
 * mostra. `recusa: "vazio"` devolve `motivo: null` de propósito — campo que
 * ainda não foi digitado não é erro, é a `Dica` inicial.
 *
 * ⚠️ `pagoCentavos === 0` (o caso comum, sem quitação parcial) **não restringe
 * a direção**: o valor previsto pode subir ou descer, é previsão.
 */
export function podeCorrigirValor(entrada: {
  situacao: SituacaoCompromisso;
  atualCentavos: number;
  pagoCentavos: number;
  /** O texto cru do campo, como saiu do dedo do Mateus. */
  texto: string;
  motivo: string;
}): PermissaoCorrecaoDeValor {
  // Fato consumado não se reescreve. Vem primeiro porque, quando bate, nenhum
  // dos outros cinco importa — a tela nem mostra formulário.
  if (entrada.situacao !== "aberto") {
    return {
      ok: false,
      recusa: "situacao_respondida",
      motivo:
        entrada.situacao === "quitado"
          ? "Este agendamento já foi respondido — ele foi pago."
          : "Este agendamento já foi respondido — foi marcado como não vai ser pago.",
    };
  }

  if (entrada.texto.trim() === "") {
    return { ok: false, recusa: "vazio", motivo: null };
  }

  // `parseValorInput` já recusa negativo (`n < 0` → null), então "não numérico"
  // e "negativo" são o mesmo ramo e a mesma mensagem.
  const centavos = parseValorInput(entrada.texto);
  if (centavos === null) {
    return { ok: false, recusa: "nao_numerico", motivo: MOTIVO_VALOR_NAO_NUMERICO };
  }

  if (centavos === entrada.atualCentavos) {
    return { ok: false, recusa: "igual_ao_atual", motivo: MOTIVO_VALOR_IGUAL_AO_ATUAL };
  }

  if (centavos === 0) {
    return { ok: false, recusa: "zero", motivo: MOTIVO_VALOR_ZERO };
  }

  if (entrada.pagoCentavos > 0 && centavos <= entrada.pagoCentavos) {
    return {
      ok: false,
      recusa: "menor_ou_igual_ao_pago",
      motivo: motivoValorMenorOuIgualAoPago(entrada.pagoCentavos),
    };
  }

  // O motivo vem por último: ele não muda nada sobre o VALOR, e mostrar o erro
  // dele enquanto o valor ainda está inválido esconderia o erro que importa.
  if (entrada.motivo.trim().length < 3) {
    return { ok: false, recusa: "sem_motivo", motivo: MOTIVO_CORRECAO_SEM_MOTIVO };
  }

  return { ok: true, valorNovoCentavos: centavos };
}

// ── Exportação em ARQUIVO SEPARADO (critério 23, Gate Fiscal 6.5) ─────────

/**
 * Cabeçalho **literal** do Gate Fiscal 6.5 / parecer §2. Copiado, não
 * reescrito, e é a primeira linha do arquivo: quem abrir o CSV no Excel dois
 * anos depois lê isto antes de qualquer número.
 */
export const CABECALHO_AGENDA_COMPROMISSOS =
  "AGENDA DE COMPROMISSOS — VALORES PREVISTOS, NÃO EXECUTADOS. NÃO COMPÕEM CUSTO DE AQUISIÇÃO.";

/** O mesmo aviso em linguagem de tela, no topo do bloco de agendados da home. */
export const CABECALHO_BLOCO_AGENDADOS =
  "Valores previstos, não executados. Não compõem custo de aquisição.";

const SEPARADOR_CSV = ";";

function campoCsv(texto: string): string {
  return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

const NOME_ORIGEM: Record<Compromisso["origem"], string> = {
  boleto: "Boleto",
  pix: "PIX",
  cartao: "Cartão",
};

const NOME_SITUACAO: Record<Compromisso["situacao"], string> = {
  aberto: "Em aberto",
  quitado: "Quitado",
  cancelado: "Cancelado",
};

/**
 * A agenda, em **arquivo separado** — nunca uma coluna a mais na exportação do
 * custo. A separação física é a quinta das cinco regras do Gate Fiscal 6: se o
 * previsto e o realizado saíssem no mesmo arquivo, alguém somaria a coluna.
 *
 * Sai TUDO, inclusive cancelado e quitado, com a situação numa coluna própria:
 * o parecer §3 diz que a previsão que não se realizou fica **registrada**, e
 * omitir linha de um arquivo de auditoria é o sumiço silencioso com outro
 * nome. Ordem: data prevista crescente, sem data por último, desempate por id.
 */
export function exportarAgendaCompromissos(
  cs: readonly Compromisso[],
): string {
  const ordenados = [...cs].sort((a, b) => {
    if (a.dataPrevista !== b.dataPrevista) {
      if (a.dataPrevista === null) return 1;
      if (b.dataPrevista === null) return -1;
      return a.dataPrevista < b.dataPrevista ? -1 : 1;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const linhas = [
    CABECALHO_AGENDA_COMPROMISSOS,
    [
      "favorecido",
      "valor previsto (R$)",
      "data prevista",
      "origem",
      "situação",
      "motivo do cancelamento",
    ].join(SEPARADOR_CSV),
    ...ordenados.map((c) =>
      [
        campoCsv(c.favorecidoNome ?? "Favorecido não informado"),
        centavosParaInput(c.valorPrevistoCentavos),
        c.dataPrevista === null ? "sem data definida" : dataBR(c.dataPrevista),
        NOME_ORIGEM[c.origem],
        NOME_SITUACAO[c.situacao],
        campoCsv(c.motivoCancelamento ?? ""),
      ].join(SEPARADOR_CSV),
    ),
  ];

  return linhas.join("\n");
}

// ── Sugestão de quitação (critérios 35-41, adendo §C) ─────────────────────

/**
 * A faixa de valor e a janela de datas são **convenção de produto**
 * (`[Likely]` no parecer), e o parecer diz por que isso é aceitável: **a
 * sugestão nunca cria vínculo**, então errar a faixa não tem consequência
 * fiscal — no máximo pergunta a mais ou pergunta a menos.
 *
 * Faixa e não valor exato **de propósito**: divergir é o normal (juros, multa,
 * desconto — §3), e exigir igualdade perderia justamente os casos que
 * interessam.
 */
export const TOLERANCIA_PERCENTUAL = 0.2;
export const TOLERANCIA_MINIMA_CENTAVOS = 50_000; // R$ 500,00
/** Assimétrica porque atraso é mais comum que antecipação (§C(a)(3)). */
export const JANELA_DIAS_ANTES = 30;
export const JANELA_DIAS_DEPOIS = 60;

/** `|pago − previsto| ≤ 20% do previsto ou ≤ R$ 500,00, o que for maior`. */
function dentroDaFaixaDeValor(
  pagoCentavos: number,
  previstoCentavos: number,
): boolean {
  const limite = Math.max(
    Math.round(previstoCentavos * TOLERANCIA_PERCENTUAL),
    TOLERANCIA_MINIMA_CENTAVOS,
  );
  return Math.abs(pagoCentavos - previstoCentavos) <= limite;
}

/**
 * Data do pagamento entre 30 dias ANTES e 60 dias DEPOIS da prevista.
 *
 * ⚠️ **SEM RECORTE DE ANO-CALENDÁRIO** (§C(a)(3)): "o par 28/12 → 05/01 é
 * exatamente onde a duplicidade custa mais caro (custo no ano errado)". Por
 * isso a conta é em DIAS corridos e nunca toca no ano.
 */
function dentroDaJanelaDeDatas(
  dataPagamento: string,
  dataPrevista: string,
): boolean {
  const dias = diasEntre(dataPrevista, dataPagamento);
  return dias >= -JANELA_DIAS_ANTES && dias <= JANELA_DIAS_DEPOIS;
}

export interface QuitacaoRecusada {
  pagamentoId: string;
  compromissoId: string;
}

/**
 * Os compromissos que este pagamento **pode** estar quitando.
 *
 * ⚠️ **ESTA FUNÇÃO NÃO CRIA VÍNCULO** (critério 41, §C(d)): ela devolve uma
 * lista para o app PERGUNTAR. "Não pode existir caminho de código que grave a
 * quitação sem ato humano explícito."
 *
 * Gatilho **cumulativo** — as três condições ao mesmo tempo (§C(a)):
 * 1. **mesmo `favorecidoId`**, cuja chave é o CNPJ/CPF. ⚠️ **Proibido casar
 *    por nome**: "CNPJ errado não é typo, é outro favorecido". Pagamento sem
 *    favorecido identificado não casa com nada — `null === null` não é
 *    identidade;
 * 2. **valor dentro da faixa**;
 * 3. **data dentro da janela**, sem recorte de ano.
 *
 * Além disso, e por construção: só `situacao === 'aberto'` (quitado ou
 * cancelado não têm o que quitar), só com `dataPrevista !== null` (sem data
 * não há janela a comparar) e nunca um par já recusado (critério 39 — "o app
 * não repergunta daquele par: repetir ensina a dispensar sem ler").
 *
 * ⚠️ **Quarta condição que o parecer não lista, e que eu acrescentei: MESMA
 * OBRA.** O §C não a considerou porque escreveu o gatilho antes de olhar o
 * multi-obra do CONTAI-003. Sugerir a quitação de um compromisso de outra
 * matrícula produziria um vínculo que `lib/data.ts` recusa de qualquer forma
 * (mesma guarda do critério 11 do CONTAI-018: nada soma entre obras, porque
 * cada matrícula é um item da declaração) — a sugestão só ensinaria o Mateus a
 * ver botão que não funciona. **Registrado para o Gate 2.**
 *
 * ⚠️ **Devolve TODOS os elegíveis** (critério 36, §5.5 do parecer de 17/08):
 * "proibido escolher o mais próximo — escolher é heurística decidindo
 * vínculo". A ordenação abaixo é só para a lista não dançar entre dois
 * carregamentos; ela não elege ninguém.
 */
export function compromissosElegiveisParaQuitacao(
  pagamento: Pick<
    Pagamento,
    "id" | "obraId" | "favorecidoId" | "valorCentavos" | "dataPagamento"
  >,
  compromissos: readonly Compromisso[],
  recusas: readonly QuitacaoRecusada[],
): Compromisso[] {
  const recusados = new Set(
    recusas
      .filter((r) => r.pagamentoId === pagamento.id)
      .map((r) => r.compromissoId),
  );

  return compromissos
    .filter((c) => c.situacao === "aberto")
    .filter((c) => c.dataPrevista !== null)
    .filter((c) => c.obraId === pagamento.obraId)
    .filter(
      (c) =>
        pagamento.favorecidoId !== null && c.favorecidoId === pagamento.favorecidoId,
    )
    .filter((c) => !recusados.has(c.id))
    .filter((c) =>
      dentroDaFaixaDeValor(pagamento.valorCentavos, c.valorPrevistoCentavos),
    )
    .filter((c) => dentroDaJanelaDeDatas(pagamento.dataPagamento, c.dataPrevista!))
    .sort((a, b) => {
      if (a.dataPrevista !== b.dataPrevista) {
        return a.dataPrevista! < b.dataPrevista! ? -1 : 1;
      }
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}

// ── Guarda de obra na quitação ───────────────────────────────────────────

export const MOTIVO_QUITACAO_OBRA_DIFERENTE =
  "Este pagamento e este agendamento estão em obras diferentes. Nada é somado " +
  "entre obras — cada matrícula é um item da declaração. Corrija a obra de um " +
  "dos dois antes de quitar.";

/**
 * Mesma guarda do critério 11 do CONTAI-018, do lado do compromisso: o banco
 * não impede (a policy `dono_compromisso_pagamento` só exige mesmo DONO), e um
 * pagamento de outra matrícula quitando este compromisso somaria custo entre
 * obras no momento em que o vínculo com o documento fosse criado.
 *
 * Vale para o caminho de escrita E para a sugestão: `compromissosElegiveisParaQuitacao`
 * já filtra por obra, e esta função é a rede de baixo, para o caminho que
 * chegar sem passar pela sugestão.
 */
export function podeQuitar(
  compromisso: Pick<Compromisso, "obraId">,
  pagamento: Pick<Pagamento, "obraId">,
): Permissao {
  if (compromisso.obraId !== pagamento.obraId) {
    return { ok: false, motivo: MOTIVO_QUITACAO_OBRA_DIFERENTE };
  }
  return { ok: true };
}

// ── Textos da sugestão — literais do ADENDO 3 §G.1, critério 38 ──────────
//
// ⚠️ ESTE BLOCO SUBSTITUI o do §C(b). A troca "compromisso" → "agendamento" na
// tela foi AUTORIZADA pelo `contador` no ADENDO 3 §G.1, `[Certain]`:
//
//     "É vocabulário de interface, não substância: as duas palavras nomeiam a
//     mesma entidade [...] Uma palavra que aparece NUM ÚNICO LUGAR do produto
//     não ensina, ela confunde: o usuário não sabe se 'compromisso' é outra
//     coisa que ele não conhece."
//
// A literalidade continua valendo — o que mudou foi a redação oficial, não a
// licença para reescrever. **A troca vale para as QUATRO linhas do bloco**,
// inclusive os rótulos dos botões e a consequência: meia troca deixa a tela
// bilíngue dentro do mesmo card.
//
// ⚠️ E NÃO SE TRADUZ O MODELO DE DADOS: "compromisso" continua no parecer, na
// tabela, nos tipos e nos nomes de função deste arquivo. Termo de domínio e
// termo de tela não precisam coincidir.

export const PERGUNTA_QUITACAO = "Este pagamento quita o agendamento de {data}?";

export function perguntaQuitacao(dataPrevistaIso: string): string {
  return PERGUNTA_QUITACAO.replace("{data}", dataBR(dataPrevistaIso));
}

/**
 * A segunda linha do bloco: quem, quanto e para quando. O valor sai marcado
 * como **previsto**, nunca como "valor" (Gate Fiscal 6.3).
 */
export function resumoDoAgendamento(c: Compromisso): string {
  const quando =
    c.dataPrevista === null ? "sem data definida" : `para ${dataBR(c.dataPrevista)}`;
  return `${c.favorecidoNome ?? "Favorecido não informado"} — previsto ${formatarBRL(
    c.valorPrevistoCentavos,
  )} ${quando}`;
}

export const QUITACAO_SIM = "Sim, quita este agendamento";
export const QUITACAO_NAO = "Não, é outro pagamento";

/**
 * O que acontece se ele não quitar — dito ANTES da escolha, porque a escolha
 * silenciosa é a que ele repete sem ler.
 */
export const QUITACAO_CONSEQUENCIA_DO_NAO =
  "Se não quitar, o agendamento continua em aberto e este pagamento fica registrado sozinho.";

// ══════════════════════════════════════════════════════════════════════════
// CONTAI-080 · PRÉ-VÍNCULO compromisso↔nota, antes do pagamento
// ══════════════════════════════════════════════════════════════════════════
//
// Fonte normativa, e nada aqui é redigido: ADENDO 6 (§J.0-J.5), ADENDO 7
// (§K.1-K.5) e ADENDO 8 (§L.1-L.4) de
// `docs/pareceres/2026-08-18-compromisso-versus-pagamento.md`.
//
// ⚠️ **Nada deste bloco devolve dinheiro somável** — a regra 2 do cabeçalho
// deste arquivo vale aqui sem exceção. O valor de cada nota aparece só DENTRO de
// texto já qualificado, e `documentosResolvidosNaConfirmacao` devolve
// `Documento[]` (registros que a esteira de `vinculo.ts` já conhece), nunca um
// total. O pré-vínculo **não entra em soma nenhuma e não é nó de `alocarCusto`**
// (§J.1): quem o converte em custo é a criação da linha em `pagamento_documento`,
// e só ela.

/**
 * O chip curto das três telas (detalhe do compromisso, detalhe da nota e a
 * linha pré-marcada do seletor) — literal, ADENDO 6 §J.2.
 *
 * ⚠️ **Nunca vermelho, nunca verde** (§J.2): *"não é pendência de risco nem
 * confirmação de custo"*. O peso visual é o do chip "Agendado" — `cor="amb"`,
 * `peso="vazado"`.
 */
export const CHIP_PRE_VINCULO = "Pré-vínculo — ainda não é custo";

/**
 * O que a tela de edição diz quando o agendamento já foi respondido.
 *
 * ⚠️ Texto de PRODUTO, não de consequência fiscal — e por isso não sai de
 * parecer nenhum: a vida do pré-vínculo é a do compromisso (critério 2), então
 * quitado ou cancelado não tem conjunto a editar. Nada de fiscal acontece nem
 * deixa de acontecer aqui.
 */
export const PRE_VINCULO_SO_EM_ABERTO =
  "Este agendamento já foi respondido. Ligar notas antecipadamente só existe " +
  "enquanto ele está em aberto — nada foi alterado.";

/**
 * Guarda de escrita do pré-vínculo: compromisso ABERTO e nota da MESMA obra.
 *
 * ⚠️ **CONTAI-081 — a recusa por `origem === "cartao"` NÃO existe mais, e a
 * constante que a explicava (`PRE_VINCULO_SEM_CARTAO`) foi removida por inteiro
 * junto com o ramo.** Ela existia pelo D2 do Gate 2 do CONTAI-080: a quitação
 * de uma compra de cartão acontecia pela fatura, por RPC que não contava N e não
 * perguntava nada, então o texto do ADENDO 8 §L.2 ("vai vincular
 * automaticamente" / "vai te perguntar") mentiria nas duas pontas.
 *
 * O CONTAI-081 construiu as duas pontas: `planoDeConversaoDaFatura` conta o N
 * ANTES da RPC, `p_propagar_origem_ids` (migration 0024) faz a propagação da
 * origem obedecer a esse N, e `/fatura/[id]/vinculos` é onde o N≥2 é perguntado.
 * Com o caminho existindo, a restrição virou o oposto do que protegia — por isso
 * a remoção é de RESTRIÇÃO, não comportamento novo para PIX/boleto (critério 16).
 *
 * ⚠️ **A assinatura perdeu `origem` de propósito** (critério 1): um ramo futuro
 * que quisesse voltar a discriminar por origem teria de acrescentar o campo de
 * novo, o que é greppável — e não cabe numa condição escondida.
 *
 * ⚠️ **A guarda de obra é a `podeVincular` de `vinculo.ts`, reaproveitada, e não
 * uma segunda cópia** (Viabilidade do ticket): a condição é a mesma do vínculo
 * formal — *"nada é somado entre obras; cada matrícula é um item da
 * declaração"* —, e duas redações dela divergiriam na primeira correção. O
 * pré-vínculo não soma nada hoje, mas ele existe para VIRAR vínculo formal no
 * ato da confirmação (§K.2): deixar entrar aqui uma nota de outra obra seria
 * plantar, numa lista de intenção, a linha que o critério 11 do CONTAI-018
 * proíbe do outro lado.
 *
 * ⚠️ **Ela mora no app, não em trigger** (mesma disciplina de
 * `pagamento_documento`/`criarVinculos`): a policy
 * `dono_compromisso_documento_previsto` da migration 0023 só exige mesmo DONO, e
 * deixaria passar uma nota de outra obra do próprio Mateus.
 */
export function podePreVincular(
  compromisso: Pick<Compromisso, "obraId" | "situacao">,
  documento: Pick<Documento, "obraId">,
): Permissao {
  if (compromisso.situacao !== "aberto") {
    return { ok: false, motivo: PRE_VINCULO_SO_EM_ABERTO };
  }
  return podeVincular({ obraId: compromisso.obraId }, documento);
}

/**
 * **Os ids da UNIÃO `documentoPrevistoIds ∪ {documentoOrigemId}`, deduplicados
 * e na ordem canônica** (origem primeiro) — SEM resolver em documentos.
 *
 * ⚠️ **É a definição ÚNICA da união**, e `documentosResolvidosNaConfirmacao` é
 * ela mais o filtro de obra: extrair isto foi a correção do D1 do Gate 2, e não
 * a criação de uma segunda contagem. O pre-mortem 1 do ticket é sobre existir
 * mais de uma REGRA de N; aqui há uma regra e dois graus de resolução, com o
 * mais grosseiro definido em função do outro.
 *
 * Existe porque há um chamador que precisa decidir sobre o conjunto **sem ter a
 * lista de documentos em mão**: a sugestão de quitação
 * (`app/_components/quitacao.tsx`) carrega a agenda, não o painel. Lá, a
 * contagem sobre ids é um **limite superior** do N resolvido — resolver só
 * ENCOLHE o conjunto (nota de outra obra ou de outro dono cai fora). Usar o
 * limite superior para decidir "posso propagar sozinho?" erra sempre para o lado
 * conservador: no máximo deixa de automatizar um N=1, nunca converte parte de um
 * conjunto N≥2 em silêncio — que é exatamente o dano que o D1 nomeia.
 */
export function idsDaUniaoDoPreVinculo(
  compromisso: Pick<Compromisso, "documentoOrigemId" | "documentoPrevistoIds">,
): string[] {
  return [
    ...new Set([
      ...(compromisso.documentoOrigemId === null
        ? []
        : [compromisso.documentoOrigemId]),
      ...compromisso.documentoPrevistoIds,
    ]),
  ];
}

/**
 * **O N do critério 10 — a UNIÃO DEDUPLICADA `documentoPrevistoIds ∪
 * {documentoOrigemId}`, resolvida em documentos da mesma obra.**
 *
 * ⚠️ **É a ÚNICA contagem de N do produto, e a unicidade é o ponto** (achado do
 * `cto-obra`): contar N só sobre a tabela nova faria o mecanismo deste ticket e
 * o `propagar_vinculo_de_origem` (CONTAI-065, migration 0020) rodarem como dois
 * automatismos independentes competindo pela MESMA guarda ("nenhuma linha em
 * `pagamento_documento` para este pagamento"), com resultado dependente da ordem
 * de execução. Um compromisso com nota de origem + 1 pré-vínculo tem N=2 e exige
 * confirmação explícita (§K.2) — se o N fosse contado só aqui dentro, ele
 * pareceria N=1 e converteria sozinho metade do conjunto.
 *
 * ⚠️ **A NOTA DE ORIGEM VEM PRIMEIRO, e os pré-vínculos na ordem de criação.**
 * O texto do ADENDO 8 §L.2 lista as notas, e lista ordenada por conveniência de
 * `Map` faria o mesmo estado ler como dois entre dois carregamentos. A origem
 * abre a lista porque é ela que a tela de edição mostra fixa no topo.
 *
 * ⚠️ **NÃO filtra por `situacao`**, e a ausência é deliberada: esta função é lida
 * no momento da CONFIRMAÇÃO e depois dela (a pré-marcação do critério 13 em
 * `/pagamento/[id]/ligar` roda com o compromisso já `quitado`). Quem exige
 * `aberto` é `podePreVincular`, que governa a EDIÇÃO, e `compromissosQuePreLigam`,
 * que governa o aviso do lado da nota.
 *
 * Documento que não está na lista de entrada (outra obra, outro dono, apagado)
 * simplesmente não resolve — mesma degradação silenciosa da RPC 0020, e pelo
 * mesmo motivo: a quitação é fato consumado e não se recusa por causa da nota.
 */
export function documentosResolvidosNaConfirmacao(
  compromisso: Pick<
    Compromisso,
    "obraId" | "documentoOrigemId" | "documentoPrevistoIds"
  >,
  documentos: readonly Documento[],
): Documento[] {
  const porId = new Map(documentos.map((d) => [d.id, d]));
  const resolvidos: Documento[] = [];

  // A DEDUPLICAÇÃO mora em `idsDaUniaoDoPreVinculo`, uma vez só: origem e
  // pré-vínculo apontando para a MESMA nota são um documento, não dois. Sem
  // isto, o caso mais provável do relato (ele pré-liga de novo, pela tela nova,
  // a nota que já era a de origem) cairia em N=2 e pediria confirmação de um
  // conjunto com uma nota só.
  for (const id of idsDaUniaoDoPreVinculo(compromisso)) {
    const documento = porId.get(id);
    if (documento === undefined) continue;
    if (!podeVincular({ obraId: compromisso.obraId }, documento).ok) continue;
    resolvidos.push(documento);
  }

  return resolvidos;
}

/**
 * Como cada nota é citada nos textos do parecer — `[Nota nº X — R$ valor]`.
 *
 * Sem número (boleto, nota registrada antes do CONTAI-004) cai no rótulo do
 * tipo: o parecer pede que a nota seja IDENTIFICÁVEL na frase, e "Nota nº —" não
 * identifica nada. Sem valor informado a frase DIZ isso, em vez de imprimir
 * R$ 0,00 — que afirmaria um valor que o registro não tem.
 */
export function identificarDocumentoPreLigado(d: Documento): string {
  const quem = d.numero ? `Nota nº ${d.numero}` : ROTULO_DO_TIPO[d.tipo];
  const quanto =
    d.valorCentavos === null
      ? "sem valor informado"
      : formatarBRL(d.valorCentavos);
  return `${quem} — ${quanto}`;
}

/**
 * **O texto expandido do detalhe do COMPROMISSO — literal, ADENDO 8 §L.2.**
 *
 * As três primeiras frases são idênticas nas duas variantes; só a última se
 * bifurca pelo N. `[Certain]` §L.1: a variante neutra única foi descartada pelo
 * `contador` porque *"apaga exatamente a informação que o texto existe para dar
 * — se o Mateus vai ou não ser perguntado de novo"*.
 *
 * ⚠️ **O N é o ATUAL, recalculado a cada render** (§L.3): a lista é editável até
 * a confirmação, e o texto não pode ficar presa ao N de quando o chip foi
 * montado. Por isso esta função recebe os documentos resolvidos e não um número
 * guardado — quem a chama já passou por
 * `documentosResolvidosNaConfirmacao` no mesmo render.
 *
 * ⚠️ **"pré-vínculo", não "vínculo" sozinho**, na última frase da variante N≥2 —
 * correção nomeada do §L.2, aplicando a razão (iii) do §J.2 ao texto que ela
 * mesma deveria ter governado.
 */
export function textoPreVinculoDoCompromisso(
  resolvidos: readonly Documento[],
): string {
  const lista = resolvidos.map(identificarDocumentoPreLigado).join(", ");
  const comum =
    `Você ligou este agendamento a ${lista} antes de pagar. Isso é só uma ` +
    "intenção registrada: enquanto o pagamento não for confirmado, esse valor " +
    "não entra no custo de aquisição, não abate a base do INSS e não aparece " +
    "em nenhum relatório da declaração. Quando você confirmar o pagamento, o " +
    "sistema vai ";
  return resolvidos.length === 1
    ? `${comum}vincular esta nota automaticamente — sem perguntar de novo.`
    : `${comum}te perguntar se este pré-vínculo ainda vale.`;
}

/**
 * **A pergunta do bloco N≥2 da confirmação — literal, ADENDO 6 §J.3.**
 *
 * Só existe para N≥2: *"com N=1 não há 'como dividir'"* (§K.1, razão 3), e o
 * caminho N=1 não tem UI nenhuma (§K.2).
 */
export function perguntaConfirmarPreVinculos(
  resolvidos: readonly Documento[],
): string {
  return (
    "Confirmar este pagamento também confirma o vínculo com " +
    `${resolvidos.map(identificarDocumentoPreLigado).join(", ")}, ` +
    "como você já tinha indicado?"
  );
}

/** Os dois botões do bloco acima — literais, ADENDO 6 §J.3. */
export const PRE_VINCULO_CONFIRMAR = "Sim, confirmar os vínculos";
export const PRE_VINCULO_REVISAR = "Revisar antes de confirmar";

/**
 * **Os agendamentos ABERTOS que pré-ligam esta nota — TODOS, sem eleição.**
 *
 * ⚠️ **Função diferente de `agendamentosPorDocumento`, e a diferença é o
 * requisito** (critério 6): aquela ELEGE um compromisso por documento, de
 * propósito, porque a Home e `/despesas` mostram "1 aviso por nota"
 * (CONTAI-072). O detalhe da nota precisa da situação COMPLETA — o caso do
 * concreto é uma nota com 3 parcelas futuras pré-ligadas, e mostrar uma só
 * esconderia duas intenções já declaradas.
 *
 * ⚠️ `situacao === "aberto"` e só: quitado ou cancelado não pré-liga nada. O
 * pré-vínculo de um compromisso quitado já cumpriu seu papel (virou, ou não,
 * linha em `pagamento_documento`), e um cancelado deixa a nota exatamente como
 * uma nota sem rastro nenhum — que é a verdade.
 *
 * ⚠️ Conta as DUAS fontes (`documentoOrigemId` e `documentoPrevistoIds`), pela
 * mesma razão do critério 10: são um conjunto só, e um aviso que ignorasse a
 * origem mentiria por omissão na nota mais comum do produto.
 */
export function compromissosQuePreLigam(
  documentoId: string,
  compromissos: readonly Compromisso[],
): Compromisso[] {
  return compromissos.filter(
    (c) =>
      c.situacao === "aberto" &&
      (c.documentoOrigemId === documentoId ||
        c.documentoPrevistoIds.includes(documentoId)),
  );
}

/**
 * **O texto expandido do detalhe da NOTA — literal, ADENDO 6 §J.2 (bloco da
 * NOTA).**
 *
 * ⚠️ **Este texto NÃO muda por N** (ADENDO 8, "Normativo para"): *"ele nunca
 * prometeu pergunta nenhuma, só descreve o estado da nota"*. O que muda com N≥2
 * é a LISTA e a concordância verbal, pela mesma convenção de colchetes que o
 * parecer usa no bloco irmão do compromisso — não é texto fiscal novo.
 *
 * ⚠️ A última frase é a que fecha o critério 8: a nota **continua** em "Notas
 * hábeis sem pagamento vinculado". Pré-vínculo não tira nota de lista nenhuma
 * (§J.1), e o texto diz isso em vez de deixar o Mateus supor.
 */
export function textoPreVinculoDaNota(
  compromissos: readonly Compromisso[],
): string {
  const lista = compromissos.map(resumoDoAgendamento).join(", ");
  const verbo =
    compromissos.length === 1 ? "está pré-ligado" : "estão pré-ligados";
  return (
    `${lista} ${verbo} a esta nota, mas nenhum pagamento aconteceu ainda. ` +
    "Esta nota continua sem pagamento vinculado até que um pagamento de " +
    "verdade seja confirmado e ligado a ela — ela segue contando em " +
    '"Notas hábeis sem pagamento vinculado".'
  );
}

/**
 * O chip e a explicação do card "Já ligados a este pagamento" (critério 14) —
 * o documento da união que a confirmação do agendamento JÁ converteu em vínculo
 * formal.
 *
 * ⚠️ **NEUTRO (âmbar vazado) e sem a palavra "automaticamente"** — correção do
 * não-bloqueante 1 do Gate 2, por duas razões independentes:
 * 1. **"automaticamente" ficou falso para metade dos casos** depois da correção
 *    do D1: com N=1 o vínculo nasce sozinho, com N≥2 ele nasce do clique em
 *    "Sim, confirmar os vínculos". Esta tela não sabe qual dos dois foi, e o
 *    card não tem por que adivinhar — o fato comum aos dois é "ligado ao
 *    confirmar o agendamento", e é esse o que se afirma.
 * 2. **VERDE era a cor errada.** No app, verde é a cor de "Custo comprovado"
 *    (`/documento/[id]`), e o documento ligado aqui pode ser boleto ou estar em
 *    quarentena — vínculo existe, custo confirmado não. O chip descreve a
 *    PROCEDÊNCIA do vínculo, nunca o efeito fiscal dele; quem decide o efeito é
 *    `alocarCusto`, e ele não olha este chip.
 *
 * O card existe porque, sem ele, a nota "sumiria" da lista de candidatos
 * (`documentosCandidatos` filtra o que já está ligado) e o Mateus não teria como
 * saber que ela não sumiu por engano — a mesma regra "nunca sumiço mudo" do
 * ADENDO de 2026-09-28 do parecer de 17/08.
 */
export const CHIP_LIGADO_AO_CONFIRMAR = "Ligado ao confirmar o agendamento";
export const LIGADO_AO_CONFIRMAR_PORQUE =
  "Ligado ao confirmar o agendamento — você já tinha indicado isso antes de " +
  "pagar.";

// ══════════════════════════════════════════════════════════════════════════
// CONTAI-081 · o pré-vínculo no caminho do CARTÃO — uma fatura, N compromissos
// ══════════════════════════════════════════════════════════════════════════
//
// Fonte normativa: os MESMOS ADENDOS 6/7/8 do bloco acima — nenhuma tese fiscal
// nova (Gate Fiscal do CONTAI-081: *"é extensão de superfície técnica da mesma
// regra"*). O que muda é só que agora **vários** compromissos resolvem N ao
// mesmo tempo, porque uma fatura quita todas as suas compras num ato.
//
// ⚠️ **NENHUMA segunda definição de N mora aqui.** As três funções abaixo são
// definidas EM CIMA de `documentosResolvidosNaConfirmacao` (que por sua vez é
// `idsDaUniaoDoPreVinculo` + filtro de obra). O pre-mortem 1 do CONTAI-080 é
// sobre existir mais de uma REGRA de N; continua havendo uma.
//
// ⚠️ **Nada aqui devolve dinheiro somável** (regra 2 do cabeçalho deste
// arquivo): saem ids, `Documento[]` e agrupamentos deles.

/**
 * Cronológica **pela data da COMPRA** (spec §1.2) — a mesma ordem em que
 * `/fatura/[id]` já lista as compras do ciclo, para o Mateus não precisar reler a
 * fatura mentalmente para achar "qual é qual".
 *
 * `dataCompra` é `null` em compromisso que não nasceu de cartão (PIX/boleto
 * agendado): cai na data prevista e, na falta das duas, no id — desempate estável
 * para a lista não dançar entre dois carregamentos. **Nunca por valor**: valor
 * não é o eixo em que ele pensa a fatura.
 */
function porDataDaCompra(a: Compromisso, b: Compromisso): number {
  const da = a.dataCompra ?? a.dataPrevista ?? "";
  const db = b.dataCompra ?? b.dataPrevista ?? "";
  if (da !== db) return da < db ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Um compromisso que converte SOZINHO (N=1) — §K.2, sem clique nenhum. */
export interface ConversaoAutomaticaDaFatura {
  compromissoId: string;
  /** A obra do compromisso — a guarda de `criarVinculos` é por obra dos DOIS lados. */
  obraId: string;
  /** O único documento da união resolvida. */
  documento: Documento;
}

/** Um compromisso que EXIGE o clique (N≥2) — §J.3, mantido pelo §K.4. */
export interface RevalidacaoDaFatura {
  compromisso: Compromisso;
  /** A união deduplicada, na ordem canônica (origem primeiro). */
  resolvidos: Documento[];
}

/**
 * **O PLANO — o que a fatura pode converter sozinha, e o que tem de esperar o
 * Mateus.** Três baldes DISJUNTOS por compromisso, decididos pelo N do §K.2.
 */
export interface PlanoDeConversaoDaFatura {
  /**
   * Os compromissos cuja nota de ORIGEM a RPC está autorizada a propagar
   * (`p_propagar_origem_ids`, migration 0024) — os de **N < 2**, e só os que têm
   * origem para propagar.
   *
   * ⚠️ É o **complemento** de `revalidar`, e é essa complementaridade que fecha o
   * D1: para N ≥ 2 a origem NÃO entra aqui, então nem ela converte antes do
   * clique — o conjunto inteiro é revalidado, não metade dele.
   */
  propagarOrigemIds: string[];
  /**
   * **N=1** — o vínculo nasce sozinho, depois da RPC, por `criarVinculos`
   * (`converterPreVinculosDaFatura`, `lib/data.ts`).
   *
   * Quando esse único documento É a nota de origem, a RPC já criou a linha (o
   * compromisso está em `propagarOrigemIds`, porque N < 2) e o `upsert` com
   * `ignoreDuplicates` faz da segunda gravação um no-op. Os dois caminhos
   * convergem na MESMA linha de `pagamento_documento` — mesma convergência que o
   * CONTAI-080 já provou no caminho de PIX/boleto.
   */
  automaticos: ConversaoAutomaticaDaFatura[];
  /**
   * **N≥2** — pendente de confirmação explícita em `/fatura/[id]/vinculos`, um
   * bloco por compromisso. Ordem cronológica pela data da compra.
   */
  revalidar: RevalidacaoDaFatura[];
}

/**
 * **O plano de conversão de UM ATO da fatura** (confirmação integral ou alocação
 * do rotativo), calculado **ANTES** da RPC.
 *
 * ⚠️ **A ORDEM É O MECANISMO, como no CONTAI-080.** A RPC da fatura propaga a
 * nota de origem por dentro do laço; se o N fosse contado depois, a origem de um
 * conjunto N≥2 já estaria gravada quando a pergunta aparecesse — o D1 do Gate 2
 * do CONTAI-080 de volta pela porta do cartão (pre-mortem 1 do CONTAI-081). Por
 * isso `propagarOrigemIds` é calculado aqui e ATRAVESSA a RPC como parâmetro.
 *
 * `compromissos` são os que ESTE ato quita — as compras abertas, em `/confirmar`;
 * as marcadas, em `/alocar`. Função pura: não olha situação (o ato é justamente o
 * que vai mudá-la) e não sabe que pagamento vai nascer.
 */
export function planoDeConversaoDaFatura(
  compromissos: readonly Compromisso[],
  documentos: readonly Documento[],
): PlanoDeConversaoDaFatura {
  const propagarOrigemIds: string[] = [];
  const automaticos: ConversaoAutomaticaDaFatura[] = [];
  const revalidar: RevalidacaoDaFatura[] = [];

  for (const compromisso of compromissos) {
    const resolvidos = documentosResolvidosNaConfirmacao(compromisso, documentos);

    if (resolvidos.length >= 2) {
      revalidar.push({ compromisso, resolvidos });
      continue;
    }

    // N < 2 (N=0 e N=1): a origem pode ir sozinha, como o CONTAI-065 sempre fez.
    // A guarda "tem origem" evita mandar à RPC um id que não tem o que propagar —
    // a RPC também devolveria `false` em silêncio, mas o array diz o que o app
    // quis dizer.
    if (compromisso.documentoOrigemId !== null) {
      propagarOrigemIds.push(compromisso.id);
    }

    if (resolvidos.length === 1) {
      automaticos.push({
        compromissoId: compromisso.id,
        obraId: compromisso.obraId,
        documento: resolvidos[0],
      });
    }
  }

  return {
    propagarOrigemIds,
    automaticos,
    revalidar: revalidar.sort((a, b) =>
      porDataDaCompra(a.compromisso, b.compromisso),
    ),
  };
}

/**
 * **Os pagamentos que a RPC acabou de criar, por compromisso — por DIFF, nunca
 * por inferência** (critério 9).
 *
 * As RPCs da fatura criam o `pagamento` por dentro e devolvem só o id do
 * desembolso: quem quiser ligar uma nota ao pagamento novo tem de descobrir qual
 * é. Casar por data e meio (`data_pagamento = a da fatura`, `meio = 'cartao'`)
 * acertaria quase sempre e erraria exatamente no caso do relato — duas parcelas
 * do MESMO fornecedor, na MESMA fatura, com o mesmo valor. Vínculo decidido por
 * semelhança é o que o §5.5 do parecer de 17/08 proíbe, e aqui erraria calado.
 *
 * O diff não adivinha nada: `compromisso_pagamento` é append-only no fluxo da
 * fatura, então o que não estava em `antes` e está em `depois` nasceu agora.
 */
export function pagamentosNovosPorCompromisso(
  antes: readonly Pick<Compromisso, "id" | "pagamentoIds">[],
  depois: readonly Pick<Compromisso, "id" | "pagamentoIds">[],
): Map<string, string[]> {
  const antigos = new Map(antes.map((c) => [c.id, new Set(c.pagamentoIds)]));
  const novos = new Map<string, string[]>();
  for (const c of depois) {
    const jaTinha = antigos.get(c.id) ?? new Set<string>();
    const nascidos = c.pagamentoIds.filter((id) => !jaTinha.has(id));
    if (nascidos.length > 0) novos.set(c.id, nascidos);
  }
  return novos;
}

/** Um bloco de `/fatura/[id]/vinculos` — e o CTA da fatura conta estes. */
export interface RevalidacaoPendente extends RevalidacaoDaFatura {
  /**
   * O pagamento que nasceu da quitação desta compra — destino do "Revisar antes
   * de confirmar" (`/pagamento/[id]/ligar`) e alvo dos vínculos do "Sim".
   */
  pagamentoId: string;
}

/**
 * **O que ainda espera decisão nesta fatura — derivado 100% do ESTADO GRAVADO**
 * (critério 10, spec §1.1). As três condições, na ordem:
 *
 * 1. o compromisso já foi respondido (`situacao !== "aberto"`) — a fatura foi
 *    confirmada ou alocada. Compromisso aberto não aparece: pendência de
 *    pré-vínculo ANTES do pagamento é o CTA do CONTAI-080 em `/compromisso/[id]`,
 *    não esta tela;
 * 2. a união resolve para **N ≥ 2** AGORA (§L.3 — o N é sempre o atual: remover
 *    um pré-vínculo depois da quitação faz o bloco sair sozinho);
 * 3. o pagamento gerado ainda **não tem vínculo nenhum** em
 *    `pagamento_documento` — mesma condição 3 do CONTAI-065, e é ela que faz o
 *    bloco desaparecer quando o Mateus confirma, ou quando ele resolve pelo
 *    caminho de `/pagamento/[id]/ligar`.
 *
 * ⚠️ **Nenhum query param entra aqui**, e é o requisito: recarregar, voltar
 * depois ou chegar pela URL mostra exatamente o que falta (critério 12). Um
 * "confirmados nesta visita" guardado em memória seria a mesma lista com uma
 * verdade a menos.
 *
 * Compromisso sem pagamento (cancelado, ou quitado sem gerar pagamento) não
 * entra: não há a que ligar nota.
 */
export function revalidacoesPendentesDaFatura(
  compromissosDaFatura: readonly Compromisso[],
  documentos: readonly Documento[],
  pagamentos: readonly Pick<Pagamento, "id" | "documentoIds">[],
): RevalidacaoPendente[] {
  const porId = new Map(pagamentos.map((p) => [p.id, p]));
  const pendentes: RevalidacaoPendente[] = [];

  for (const compromisso of compromissosDaFatura) {
    if (compromisso.situacao === "aberto") continue;

    const resolvidos = documentosResolvidosNaConfirmacao(compromisso, documentos);
    if (resolvidos.length < 2) continue;

    // O primeiro pagamento deste compromisso ainda SEM vínculo nenhum. No fluxo
    // da fatura é sempre um só (uma compra, um pagamento); o `find` cobre o caso
    // N:M de `compromisso_pagamento` sem inventar rateio entre pagamentos.
    const pendente = compromisso.pagamentoIds
      .map((id) => porId.get(id))
      .find((p) => p !== undefined && p.documentoIds.length === 0);
    if (pendente === undefined) continue;

    pendentes.push({ compromisso, resolvidos, pagamentoId: pendente.id });
  }

  return pendentes.sort((a, b) => porDataDaCompra(a.compromisso, b.compromisso));
}
