/**
 * **CONTAI-092 — o que o Google Calendar deve conter, derivado do compromisso.**
 *
 * Módulo PURO: nada aqui fala com rede, com banco nem com `window`. Entra um
 * compromisso, sai o evento desejado (ou `null` = "nenhum evento deve existir").
 * É esse desenho que o `cto-obra` opôs à sincronização por transição ("criou →
 * cria, mudou → atualiza, quitou → remove"): com estado DERIVADO, um hook
 * esquecido num caminho secundário não produz lembrete fantasma, porque a
 * próxima leitura do compromisso recalcula tudo do zero.
 *
 * ⚠️ **GATE FISCAL (critérios 7, 7a-c e 8 do ticket) — a restrição vive aqui.**
 * O texto do evento sai de uma conta Google pessoal, fora do app, e por isso tem
 * regra dura:
 * - **7a** nenhum vocabulário que sugira controle fiscal oficial ou vínculo com
 *   apuração ("vencimento fiscal", "obrigação", "prazo legal", "DARF",
 *   "aferição"). O compromisso aqui é obrigação **contratual** com fornecedor,
 *   não prazo tributário;
 * - **7b** a ausência do evento nunca é apresentada como fato sobre o
 *   compromisso — este módulo não escreve texto nenhum sobre falha;
 * - **7c** nada sobre documentação hábil (nota recebida, retenção, "em dia com
 *   o Fisco");
 * - **8** os campos permitidos são EXATAMENTE favorecido (nome), valor, forma de
 *   pagamento e data. **CPF nunca** — nem do favorecido, nem do Mateus —, nem
 *   número de nota, nem id de nada.
 *
 * A trava disso é o tipo: `eventoDesejado` recebe um `Pick<Compromisso, …>` que
 * **não inclui** `favorecidoId`, `documentoOrigemId` nem
 * `documentoPrevistoIds`. Não é disciplina de quem escreve o texto: o dado
 * proibido não chega aqui. `lib/agenda/evento.test.ts` confere a lista de termos
 * e a ausência de CPF por varredura do objeto inteiro.
 */

import { formatarDataBR } from "@/lib/fiscal/obra";
import { formatarBRL } from "@/lib/money";
import type { Compromisso } from "@/lib/types";

/**
 * O fuso é FIXO, e não o do aparelho: o lembrete "no dia" tem de soar às 9h de
 * Florianópolis, não às 9h de onde o servidor da Vercel estiver rodando.
 */
export const FUSO = "America/Sao_Paulo";

/**
 * Hora do evento (critério 1): o lembrete de offset zero soa no INÍCIO do
 * evento, então um evento de "dia inteiro" faria o aviso "no dia" chegar à
 * meia-noite. 09:00 é horário útil — dá tempo de pagar no mesmo dia.
 */
export const HORA_DO_EVENTO = "09:00:00";
/**
 * 30 minutos. O Google exige `end`, e a duração não significa nada aqui (ninguém
 * "comparece" a um lembrete) — o que importa é não ocupar a agenda inteira do dia
 * e não virar bloco de dia todo, que mudaria o disparo do offset zero.
 */
const FIM_DO_EVENTO = "09:30:00";

/**
 * Os três offsets, em MINUTOS antes do início (critério 1): 5 dias, 2 dias e no
 * dia. Fechado pelo Mateus no relato de origem — não é configurável e não se
 * reabre aqui.
 *
 * ⚠️ **UM evento com três `overrides`, nunca três eventos** (Out of Scope do
 * ticket): três objetos de evento triplicariam a superfície de duplicação que o
 * id determinístico existe para fechar.
 */
export const LEMBRETES_EM_MINUTOS = [5 * 24 * 60, 2 * 24 * 60, 0] as const;

/** Rótulo da forma de pagamento como ele aparece no evento. */
const FORMA: Record<"pix" | "boleto", string> = {
  pix: "Pix",
  boleto: "Boleto",
};

export interface LembreteDoEvento {
  method: "popup";
  minutes: number;
}

export interface EventoDesejado {
  /** Derivado de `compromisso.id` — ver `eventIdDeCompromisso`. */
  eventId: string;
  titulo: string;
  descricao: string;
  /** `YYYY-MM-DDTHH:MM:SS`, sem offset: o fuso vai no campo `timeZone`. */
  inicio: string;
  fim: string;
  fuso: string;
  lembretes: LembreteDoEvento[];
}

/** O que `eventoDesejado` precisa saber — e nada além disso (Gate Fiscal 8). */
export type CompromissoParaAgenda = Pick<
  Compromisso,
  "id" | "origem" | "situacao" | "dataPrevista" | "valorPrevistoCentavos" | "favorecidoNome"
>;

/**
 * **O id do evento no Google, DERIVADO do compromisso (critério 3).**
 *
 * O Google aceita id customizado em `events.insert` desde que seja base32hex
 * (dígitos e letras `a`–`v`) com 5 a 1024 caracteres. Um uuid sem hífens é 32
 * caracteres em `[0-9a-f]` — subconjunto estrito do permitido.
 *
 * ⚠️ **É isso, e só isso, que torna "nunca um segundo evento" uma garantia
 * ESTRUTURAL.** Com id derivado, a segunda tentativa de criar o mesmo evento
 * recebe 409 do Google e vira `patch` (ver `lib/agenda/google.ts`). A
 * alternativa — guardar o id devolvido pelo Google e buscar antes de criar —
 * depende de a escrita anterior ter chegado ao banco, e é exatamente a
 * suposição que quebra numa falha parcial ou numa corrida entre duas abas. É o
 * pre-mortem 2 do ticket fechado por construção.
 *
 * Lança em id que não é uuid: id inválido gera 400 do Google, e um 400 de
 * configuração não tem retry (critério 10) — falharia em silêncio para sempre.
 */
export function eventIdDeCompromisso(compromissoId: string): string {
  const derivado = compromissoId.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(derivado)) {
    throw new Error(
      `compromisso.id não é um uuid: "${compromissoId}" — sem uuid não há id ` +
        "de evento determinístico, e sem ele a garantia de não duplicar cai.",
    );
  }
  return derivado;
}

/**
 * **O estado desejado no Google.** `null` significa "nenhum evento deve
 * existir" — e as quatro razões para isso são os critérios 2 e 4:
 *
 * 1. `origem === 'cartao'` — cartão **nunca** gera evento, em nenhum momento do
 *    ciclo de vida (critério 2). O lembrete do cartão iria pela fatura, que já
 *    tem fluxo próprio de confirmação de vínculo (CONTAI-022);
 * 2. `situacao === 'quitado'` — já pagou;
 * 3. `situacao === 'cancelado'` — não vai ser pago;
 * 4. `dataPrevista === null` — "sem data definida" é estado legítimo (saldo de
 *    quitação parcial, CONTAI-019 §D): não há dia para o qual apontar.
 *
 * Nos casos 2-4 o evento é REMOVIDO, nunca "marcado" (critério 4): evento
 * marcado continua aparecendo na agenda do Mateus, e o histórico do compromisso
 * já mora no app.
 */
export function eventoDesejado(c: CompromissoParaAgenda): EventoDesejado | null {
  if (c.origem === "cartao") return null;
  if (c.situacao !== "aberto") return null;
  if (c.dataPrevista === null) return null;

  const valor = formatarBRL(c.valorPrevistoCentavos);
  const favorecido = c.favorecidoNome?.trim() ?? "";

  return {
    eventId: eventIdDeCompromisso(c.id),
    // Favorecido nulo existe no modelo (`favorecido_id` é nullable desde a
    // 0007), e nesse caso o título não inventa nome nenhum.
    titulo:
      favorecido.length > 0
        ? `Pagamento ${favorecido} — ${valor}`
        : `Pagamento agendado — ${valor}`,
    descricao: descricaoDoEvento(c, favorecido, valor),
    inicio: `${c.dataPrevista}T${HORA_DO_EVENTO}`,
    fim: `${c.dataPrevista}T${FIM_DO_EVENTO}`,
    fuso: FUSO,
    lembretes: LEMBRETES_EM_MINUTOS.map((minutes) => ({
      method: "popup" as const,
      minutes,
    })),
  };
}

/**
 * O corpo do evento, literal do `design/mocks/CONTAI-092.md` (seção "Evento do
 * Google Calendar"), **verificado pelo `contador` contra 7a-c e 8 no Gate Fiscal
 * do ticket e aprovado como está**.
 *
 * ⚠️ A frase de abertura é a que carrega a restrição: ela diz, dentro do próprio
 * lembrete, que isto é conveniência e **não** controle fiscal nem garantia de
 * pagamento em dia. Reescrevê-la exige conferir a nova redação contra a lista do
 * Gate Fiscal (7a-c, 8) antes de ir a produção — está dito no critério 8.
 */
function descricaoDoEvento(
  c: CompromissoParaAgenda,
  favorecido: string,
  valor: string,
): string {
  // `origem` aqui só pode ser pix ou boleto: o cartão saiu em `eventoDesejado`.
  const forma = FORMA[c.origem as "pix" | "boleto"];
  return [
    "Lembrete de pagamento agendado no contai — conveniência, não é controle " +
      "fiscal nem garantia de que o pagamento vai sair em dia.",
    "",
    `Favorecido: ${favorecido.length > 0 ? favorecido : "não informado"}`,
    `Valor previsto: ${valor}`,
    `Forma: ${forma}`,
    // `dataPrevista` não é nula aqui (guarda de `eventoDesejado`).
    `Vencimento previsto: ${formatarDataBR(c.dataPrevista!)}`,
  ].join("\n");
}

/**
 * **A régua da reconciliação (critério 11)** e, de carona, a contagem de
 * "Pendentes" do card de `/conta`.
 *
 * Pura e derivada: compara o estado DESEJADO (calculado do compromisso de agora)
 * com o estado SINCRONIZADO (o que a última escrita bem-sucedida deixou no
 * Google). Divergência = há trabalho a fazer.
 *
 * ⚠️ Cobre os dois sentidos, e é o segundo que fecha o pre-mortem 3 (lembrete
 * fantasma por caminho alternativo de quitação): não basta "falta criar", tem de
 * pegar também "existe lá e não deveria".
 *
 * ⚠️ **O VALOR PREVISTO não entra na comparação**, e a ausência é deliberada: o
 * critério 12 fixa as colunas de `compromisso_agenda` e não há
 * `valor_sincronizado`. Correção de valor dispara a sincronização no ato (a tela
 * de `/compromisso/[id]/valor` chama `sincronizarAgenda`), mas uma correção cuja
 * sincronização falhou não é redetectada pela reconciliação — dívida declarada
 * no retorno do Gate 1, não um esquecimento.
 */
export function precisaSincronizar(
  c: CompromissoParaAgenda,
  linha: EstadoSincronizado | null,
): boolean {
  const desejado = eventoDesejado(c);
  if (desejado === null) {
    // Nada deve existir: só há trabalho se o app deixou um evento lá.
    return linha !== null && linha.estado === "presente";
  }
  if (linha === null) return true;
  return (
    linha.estado !== "presente" ||
    linha.dataSincronizada !== c.dataPrevista ||
    linha.situacaoSincronizada !== c.situacao
  );
}

/**
 * A guarda da LINHA de "não sincronizado" no detalhe do compromisso
 * (`design/mocks/CONTAI-092.md`): falha **registrada** e ainda não resolvida.
 *
 * Definida sobre `precisaSincronizar` de propósito — duas definições paralelas
 * de "está pendente" divergiriam, e a tela passaria a discordar do card de
 * `/conta`. O que esta acrescenta é só o `ultimo_erro`: sem ele, um compromisso
 * criado há dois segundos (sincronização ainda em voo) acenderia a linha âmbar
 * por um instante, dizendo que falhou algo que não falhou.
 */
export function falhouSincronizacao(
  c: CompromissoParaAgenda,
  linha: EstadoSincronizado | null,
): boolean {
  if (linha === null || linha.ultimoErro === null) return false;
  return precisaSincronizar(c, linha);
}

/** A parte de `compromisso_agenda` que as funções puras acima leem. */
export interface EstadoSincronizado {
  estado: "presente" | "removido";
  dataSincronizada: string | null;
  situacaoSincronizada: Compromisso["situacao"] | null;
  ultimoErro: string | null;
}
