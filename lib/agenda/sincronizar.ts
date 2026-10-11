/**
 * **CONTAI-092 — a sincronização, por ESTADO DERIVADO.**
 *
 * ⚠️ **Não é sincronização por transição**, e a diferença é a Viabilidade do
 * ticket inteira. O relato original descrevia "quando cria → cria; quando muda →
 * atualiza; quando quita → remove", e o `cto-obra` registrou discordância: esta
 * função **não recebe o que aconteceu**. Ela recebe um `compromissoId` (ou
 * "tudo"), **lê o compromisso no banco**, calcula o estado desejado no Google e
 * aplica. Nunca acredita no que o cliente diz que aconteceu.
 *
 * O ganho é o pre-mortem 3 fechado: um hook esquecido num caminho secundário
 * (quitação em lote, `desfazerOrigem`, tela nova) não produz lembrete fantasma,
 * porque a próxima leitura recalcula tudo do zero — e a reconciliação do
 * critério 11 vira um laço sobre a mesma função, não um segundo algoritmo.
 *
 * ⚠️ **Nada aqui escreve em `pendencia`** (critério 9, ressalva do `contador`):
 * falha de sincronização é estado de integração operacional, não pendência
 * fiscal, e não pode aparecer em relatório anual nem no dossiê de venda. O
 * módulo não importa nada de `lib/fiscal/` e não conhece a tabela `pendencia`.
 *
 * ⚠️ **Roda SÓ no servidor** (precisa do refresh token e do `client_secret`).
 */

import { configDoGoogle } from "@/lib/agenda/config";
import {
  eventIdDeCompromisso,
  eventoDesejado,
  precisaSincronizar,
  type CompromissoParaAgenda,
  type EstadoSincronizado,
} from "@/lib/agenda/evento";
import type { DadosDaIntegracao } from "@/lib/agenda/estado";
import {
  AgendaIndisponivelError,
  AgendaRecusouError,
  AutorizacaoRevogadaError,
} from "@/lib/agenda/erros";
import {
  gravarEvento,
  removerEvento,
  renovarAccessToken,
} from "@/lib/agenda/google";
import type { ClienteServidor } from "@/lib/supabase-servidor";
import { numericParaCentavos } from "@/lib/money";
import type { CompromissoAgendaRow, IntegracaoGoogleRow } from "@/lib/types";

/** Colunas do compromisso que a agenda lê — e **só** elas (Gate Fiscal 8). */
const COLUNAS_COMPROMISSO =
  "id, origem, situacao, data_prevista, valor_previsto, favorecido(nome)";

interface LinhaDeCompromisso {
  id: string;
  origem: CompromissoParaAgenda["origem"];
  situacao: CompromissoParaAgenda["situacao"];
  data_prevista: string | null;
  valor_previsto: number | string;
  favorecido: { nome: string } | null;
}

function paraAgenda(row: LinhaDeCompromisso): CompromissoParaAgenda {
  return {
    id: row.id,
    origem: row.origem,
    situacao: row.situacao,
    dataPrevista: row.data_prevista,
    valorPrevistoCentavos: numericParaCentavos(row.valor_previsto) ?? 0,
    favorecidoNome: row.favorecido?.nome ?? null,
  };
}

function paraEstado(row: CompromissoAgendaRow): EstadoSincronizado {
  return {
    estado: row.estado,
    dataSincronizada: row.data_sincronizada,
    situacaoSincronizada: row.situacao_sincronizada,
    ultimoErro: row.ultimo_erro,
  };
}

export type SituacaoSincronizacao =
  /** Variável de ambiente ausente: nenhuma chamada ao Google (critério 15). */
  | "nao_configurado"
  /** Autorização nunca concluída: nenhuma chamada ao Google (critério 5). */
  | "sem_integracao"
  /** Credencial morta — `revogado_em` gravado, nada mais é tentado (critério 6). */
  | "revogada"
  | "concluida";

export interface ResultadoSincronizacao {
  situacao: SituacaoSincronizacao;
  /** Eventos criados, atualizados ou removidos com sucesso nesta chamada. */
  aplicados: number;
  /** Compromissos cuja escrita falhou (erro registrado em `ultimo_erro`). */
  falhas: number;
  /** Quantos continuam pendentes DEPOIS desta chamada. */
  pendentes: number;
}

const ZERADO = { aplicados: 0, falhas: 0, pendentes: 0 };

export type Alvo = { compromissoId: string } | { tudo: true };

/**
 * A integração do usuário, ou `null`. Lê **sem** o `refresh_token` quando ele
 * não é necessário — ver `lerDadosDaIntegracao`.
 */
async function lerIntegracao(
  supabase: ClienteServidor,
): Promise<IntegracaoGoogleRow | null> {
  const { data, error } = await supabase
    .from("integracao_google")
    .select("*")
    .limit(1);
  if (error) throw error;
  return (data?.[0] as IntegracaoGoogleRow | undefined) ?? null;
}

/**
 * Carimba a revogação (critério 6). Depois disto nenhuma chamada ao Google sai
 * até o Mateus reautorizar, e o card de `/conta` muda para o estado 4 na carga
 * seguinte da tela — é o que impede o pre-mortem 1 (token morto em silêncio).
 */
async function marcarRevogada(
  supabase: ClienteServidor,
  motivo: string,
): Promise<void> {
  const { error } = await supabase
    .from("integracao_google")
    .update({ revogado_em: new Date().toISOString(), motivo_revogacao: motivo })
    // `is null` para não reescrever o carimbo de uma revogação já detectada: a
    // data que interessa é a da PRIMEIRA vez que o Google recusou — é ela que
    // diz desde quando os lembretes pararam de sair.
    .is("revogado_em", null);
  if (error) {
    console.warn(`[agenda] não deu para marcar a revogação: ${error.message}`);
  }
}

/**
 * **A sincronização.** Aplica no Google o estado que o banco descreve.
 *
 * ⚠️ **Nunca lança por falha de integração**: ela é chamada DEPOIS da gravação do
 * compromisso e não pode bloquear nem reverter nada (critério 5). O que não deu
 * certo volta como contagem e fica em `ultimo_erro`.
 */
export async function sincronizar(
  supabase: ClienteServidor,
  alvo: Alvo,
): Promise<ResultadoSincronizacao> {
  const config = configDoGoogle();
  if (!config) return { situacao: "nao_configurado", ...ZERADO };

  const integracao = await lerIntegracao(supabase);
  if (!integracao) return { situacao: "sem_integracao", ...ZERADO };
  if (integracao.revogado_em !== null) {
    return { situacao: "revogada", ...ZERADO };
  }

  // ── O que o banco diz que deveria estar no Google ──────────────────────
  const compromissos = await lerCompromissos(supabase, alvo);
  const linhas = await lerLinhasDaAgenda(
    supabase,
    "tudo" in alvo ? null : alvo.compromissoId,
  );

  const alvos = compromissos.filter((c) =>
    precisaSincronizar(c, linhas.get(c.id) ?? null),
  );
  if (alvos.length === 0) {
    return { situacao: "concluida", ...ZERADO, pendentes: 0 };
  }

  // ── Credencial ────────────────────────────────────────────────────────
  let accessToken: string;
  try {
    accessToken = await renovarAccessToken(config, integracao.refresh_token);
  } catch (erro) {
    if (erro instanceof AutorizacaoRevogadaError) {
      await marcarRevogada(supabase, erro.motivo);
      return { situacao: "revogada", ...ZERADO, pendentes: alvos.length };
    }
    // Google fora do ar na renovação: tudo continua pendente, nada é marcado
    // como revogado (critério 6 é só para credencial morta).
    console.warn(`[agenda] renovação do token falhou: ${mensagem(erro)}`);
    return {
      situacao: "concluida",
      aplicados: 0,
      falhas: alvos.length,
      pendentes: alvos.length,
    };
  }

  // ── Aplicação, um compromisso por vez ─────────────────────────────────
  // Sequencial de propósito: a conta do Mateus é uma e a cota do Calendar é por
  // usuário — paralelizar N escritas é o caminho mais curto para o 429 que o
  // retry teria de absorver.
  let aplicados = 0;
  let falhas = 0;

  for (const c of alvos) {
    try {
      await aplicar(accessToken, c);
      await registrarSucesso(supabase, c);
      aplicados += 1;
    } catch (erro) {
      if (erro instanceof AutorizacaoRevogadaError) {
        // Para TUDO: credencial morta no meio do laço não melhora no próximo
        // item, e cada tentativa extra é mais um 401 sem informação nova.
        await marcarRevogada(supabase, erro.motivo);
        await registrarFalha(supabase, c, erro.message);
        return {
          situacao: "revogada",
          aplicados,
          falhas: falhas + 1,
          pendentes: alvos.length - aplicados,
        };
      }
      if (
        erro instanceof AgendaIndisponivelError ||
        erro instanceof AgendaRecusouError
      ) {
        await registrarFalha(supabase, c, erro.message);
        falhas += 1;
        continue;
      }
      // Erro inesperado (bug nosso, id que não é uuid): registra e segue — um
      // compromisso estragado não pode travar a reconciliação dos outros.
      await registrarFalha(supabase, c, mensagem(erro));
      falhas += 1;
    }
  }

  return {
    situacao: "concluida",
    aplicados,
    falhas,
    pendentes: alvos.length - aplicados,
  };
}

/** Criar/atualizar ou remover, conforme o estado desejado. */
async function aplicar(
  accessToken: string,
  c: CompromissoParaAgenda,
): Promise<void> {
  const desejado = eventoDesejado(c);
  if (desejado === null) {
    // Quitado, cancelado, sem data ou cartão → o evento NÃO deve existir.
    await removerEvento(accessToken, eventIdDeCompromisso(c.id));
    return;
  }
  await gravarEvento(accessToken, desejado);
}

/**
 * O resultado de uma tentativa BEM-SUCEDIDA. `ultimo_erro` volta a `null`: a
 * linha âmbar do detalhe do compromisso desaparece porque o fato deixou de ser
 * verdadeiro, não porque alguém a dispensou.
 */
async function registrarSucesso(
  supabase: ClienteServidor,
  c: CompromissoParaAgenda,
): Promise<void> {
  const desejado = eventoDesejado(c);
  const agora = new Date().toISOString();
  const { error } = await supabase.from("compromisso_agenda").upsert(
    {
      compromisso_id: c.id,
      google_event_id: eventIdDeCompromisso(c.id),
      estado: desejado === null ? "removido" : "presente",
      // O check `compromisso_agenda_presente_tem_data` exige a data quando o
      // evento está presente — e `eventoDesejado` só devolve evento quando ela
      // existe, então os dois concordam por construção.
      data_sincronizada: desejado === null ? null : c.dataPrevista,
      situacao_sincronizada: c.situacao,
      sincronizado_em: agora,
      tentado_em: agora,
      ultimo_erro: null,
    },
    { onConflict: "compromisso_id" },
  );
  if (error) throw error;
}

/**
 * O resultado de uma tentativa que FALHOU (critério 10: toda tentativa carimba
 * `tentado_em`/`ultimo_erro`).
 *
 * ⚠️ **`estado` e `sincronizado_em` NÃO são tocados**: eles descrevem a última
 * escrita bem-sucedida, e sobrescrevê-los numa falha apagaria a única informação
 * que diz se existe ou não evento lá. Quando a linha ainda não existe, ela nasce
 * com `estado = 'removido'` — que é o fato: nenhum evento foi criado.
 */
async function registrarFalha(
  supabase: ClienteServidor,
  c: CompromissoParaAgenda,
  erro: string,
): Promise<void> {
  const falha = {
    tentado_em: new Date().toISOString(),
    // Mensagem truncada: ela vai para o log e para `ultimo_erro`, nunca para a
    // tela (o texto que o Mateus lê é fixo — Gate Fiscal 7b).
    ultimo_erro: erro.slice(0, 500),
  };

  /**
   * ⚠️ **UPDATE PRIMEIRO, INSERT só se ele não achou linha** — e a ordem é a
   * correção do Gate 2.
   *
   * O desenho anterior era `select` → decidir → `update`/`insert`, e entre o
   * `select` e o `insert` cabe outra requisição (duas abas, ou a reconciliação
   * de 6h rodando junto com um "tentar de novo"). A segunda levava 23505 na PK,
   * caía no `console.warn` — e **a linha âmbar do detalhe não acendia**, porque
   * `ultimo_erro` nunca era gravado. Falha de integração que não se registra é
   * pior do que falha: é silêncio, que é exatamente o que o critério 9 e o
   * pre-mortem 1 existem para evitar.
   *
   * O `update` carrega a decisão e a escrita no MESMO comando: `.select()` faz
   * o PostgREST devolver as linhas afetadas, então zero linhas é "não existe
   * ainda", sem janela nenhuma.
   */
  const atualizado = await supabase
    .from("compromisso_agenda")
    .update(falha)
    .eq("compromisso_id", c.id)
    .select("compromisso_id");
  if (atualizado.error) {
    console.warn(
      `[agenda] não deu para registrar a falha: ${atualizado.error.message}`,
    );
    return;
  }
  if ((atualizado.data?.length ?? 0) > 0) return;

  // ⚠️ `estado: "removido"` e `situacao_sincronizada: null` porque é a primeira
  // tentativa e ela falhou: não existe evento no Google, e nenhuma situação foi
  // sincronizada. Os dois descrevem a última escrita BEM-SUCEDIDA, que aqui não
  // houve.
  const inserido = await supabase.from("compromisso_agenda").insert({
    compromisso_id: c.id,
    google_event_id: eventIdDeCompromisso(c.id),
    estado: "removido",
    situacao_sincronizada: null,
    ...falha,
  });
  if (!inserido.error) return;

  // Corrida perdida: outra requisição inseriu a linha entre o `update` vazio e
  // este `insert`. O erro da PK é informação, não falha — a linha existe agora,
  // então o `update` que antes não achou nada passa a achar.
  if (inserido.error.code === "23505") {
    const { error } = await supabase
      .from("compromisso_agenda")
      .update(falha)
      .eq("compromisso_id", c.id);
    if (!error) return;
  }
  console.warn(
    `[agenda] não deu para registrar a falha: ${inserido.error.message}`,
  );
}

async function lerCompromissos(
  supabase: ClienteServidor,
  alvo: Alvo,
): Promise<CompromissoParaAgenda[]> {
  const consulta = supabase.from("compromisso").select(COLUNAS_COMPROMISSO);
  const { data, error } =
    "tudo" in alvo
      ? // ⚠️ Sem filtro de obra e sem filtro de situação: a reconciliação precisa
        // ver TAMBÉM os quitados e cancelados, porque é neles que mora o
        // lembrete fantasma (pre-mortem 3). O `cartao` entra na lista e sai em
        // `eventoDesejado` → `precisaSincronizar`, que para ele é sempre
        // "nenhum evento deve existir" — ele nunca gera escrita.
        await consulta
      : await consulta.eq("id", alvo.compromissoId);
  if (error) throw error;
  return ((data ?? []) as unknown as LinhaDeCompromisso[]).map(paraAgenda);
}

async function lerLinhasDaAgenda(
  supabase: ClienteServidor,
  compromissoId: string | null,
): Promise<Map<string, EstadoSincronizado>> {
  const consulta = supabase.from("compromisso_agenda").select("*");
  const { data, error } =
    compromissoId === null
      ? await consulta
      : await consulta.eq("compromisso_id", compromissoId);
  if (error) throw error;
  return new Map(
    ((data ?? []) as CompromissoAgendaRow[]).map((row) => [
      row.compromisso_id,
      paraEstado(row),
    ]),
  );
}

/**
 * O que o card "Integrações" de `/conta` precisa (critério 16) — montado no
 * servidor porque o estado 1 depende de variável de ambiente server-only.
 *
 * ⚠️ **`refresh_token` nunca sai desta função.** O `select` é explícito nas
 * colunas, e não `*`: a resposta da rota vai para o browser.
 */
export async function lerDadosDaIntegracao(
  supabase: ClienteServidor,
): Promise<DadosDaIntegracao> {
  const configurado = configDoGoogle() !== null;

  const { data, error } = await supabase
    .from("integracao_google")
    .select("email_conta, concedido_em, revogado_em")
    .limit(1);
  if (error) throw error;
  const integracao = data?.[0] ?? null;

  // Sem autorização nenhuma, "pendentes" não tem sentido: nada está esperando
  // sincronização porque nada vai ser sincronizado. Contar aqui também
  // custaria duas leituras por carga de `/conta` sem nada a mostrar.
  const pendentes = integracao === null ? 0 : await contarPendentes(supabase);

  return {
    configurado,
    concedidoEm: integracao?.concedido_em ?? null,
    revogadoEm: integracao?.revogado_em ?? null,
    emailConta: integracao?.email_conta ?? null,
    pendentes,
  };
}

/**
 * Quantos compromissos estão com o lembrete fora de dia — a linha "Pendentes"
 * do card, mostrada **sempre, inclusive em 0** (spec de design: zero é a
 * confirmação de que está tudo sincronizado, não um buraco na tela).
 *
 * ⚠️ É a MESMA régua da reconciliação (`precisaSincronizar`), de propósito: uma
 * segunda definição de "pendente" faria o card discordar do que o botão
 * "Sincronizar agora" tem para fazer.
 */
async function contarPendentes(supabase: ClienteServidor): Promise<number> {
  const compromissos = await lerCompromissos(supabase, { tudo: true });
  const linhas = await lerLinhasDaAgenda(supabase, null);
  return compromissos.filter((c) =>
    precisaSincronizar(c, linhas.get(c.id) ?? null),
  ).length;
}

function mensagem(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}
