/**
 * Política de rede das telas — CONTAI-006.
 *
 * Achado de origem (Gate 3 do CONTAI-001): o E2E "banco fora, com saída" levava
 * **7,8 s**. O postgrest-js repete GET com backoff exponencial 1 s + 2 s + 4 s
 * (`DEFAULT_MAX_RETRIES = 3`, `getRetryDelay = 1000 * 2 ** tentativa`), e o
 * número não é configurável por chamada — só dá para DESLIGAR, pelo
 * `db.retry: false` do `createClient`. É o que `lib/supabase.ts` faz: a repetição
 * passa a acontecer aqui, com números escolhidos para tela na mão de gente.
 *
 * ── Os números, e por que estes (critério 4: "o comportamento tem que ser
 *    DECIDIDO, não um número específico") ────────────────────────────────────
 *
 * `TETO_DE_LEITURA_MS = 5000`. A Pergunta Aberta 3 do ticket ("qual é o teto
 * tolerável para você — 3 s, 5 s?") continua sem resposta do Mateus, então
 * adoto o LIMITE SUPERIOR que ele mesmo nomeou. Escolher 3 s seria decidir por
 * ele no sentido que o Pre-mortem 2 avisa ser o pior ("o retry é encurtado e o
 * app passa a falhar em oscilações que hoje absorve"): em 4G ruim, trocar
 * espera longa por erro fácil é regressão. 5 s corta ~35% dos 7,7 s medidos e
 * não sacrifica nenhuma tentativa no caso comum. Quando ele responder, muda-se
 * ESTA constante — e o E2E `estado de erro: banco fora, com saída` mede.
 *
 * `MS_POR_TENTATIVA = 2500`. A tela é obrigada a admitir a espera aos 2 s
 * (critério 1). Uma tentativa que passou de 2,5 s sem responder já forçou a
 * tela a dizer que não sabe; insistir NA MESMA conexão travada não compra nada,
 * e conexão nova em link oscilante costuma ser o que destrava.
 *
 * `ESPERAS_ENTRE_TENTATIVAS_MS = [400, 1200]` → três tentativas ao todo. Mantém
 * a ideia do backoff (a segunda espera é o triplo da primeira, dá tempo de um
 * soluço passar) sem o primeiro segundo morto que produzia a "mentira" do
 * achado. No caso medido — 503 devolvido na hora — o erro final sai em ~1,7 s
 * em vez de 7,7 s.
 *
 * `TETO_DE_GRAVACAO_MS = 10000`, o dobro do de leitura, **de propósito**.
 * Desistir cedo de uma LEITURA não custa nada: repetir GET é seguro e o botão
 * "Tentar de novo" resolve. Desistir cedo de uma GRAVAÇÃO fabrica exatamente a
 * ambiguidade que o critério 6 existe para eliminar ("não sei se salvou"), e
 * gravação não tem retry automático (Out of Scope do ticket). Então o teto de
 * escrita é generoso: ele só existe para que nada espere para sempre.
 *
 * Gravação NUNCA é repetida aqui — nem pelo postgrest-js, nem por este módulo.
 * "Retry automático de gravação" é Out of Scope do ticket, e retry de escrita
 * sem idempotência é a receita do registro duplicado.
 */

/** Aos ~2 s a tela para de dizer "carregando" (critério 1). */
export const MS_ATE_AVISAR = 2000;

/** Segundo tier: cobre o projeto que acorda de pausa (critério 7). */
export const MS_ATE_SEGUNDO_AVISO = 3500;

/** Teto de espera de uma LEITURA de tela (critérios 3 e 5). */
export const TETO_DE_LEITURA_MS = 5000;

/** Teto de espera de uma GRAVAÇÃO. Ver o cabeçalho: é generoso de propósito. */
export const TETO_DE_GRAVACAO_MS = 10000;

/** Tempo máximo de UMA tentativa de leitura antes de abrir conexão nova. */
export const MS_POR_TENTATIVA = 2500;

/** Esperas entre as tentativas de leitura — duas esperas, três tentativas. */
export const ESPERAS_ENTRE_TENTATIVAS_MS: readonly number[] = [400, 1200];

/**
 * ⚠️ A ORDEM dos textos de espera — é o critério 2 em forma de função pura.
 *
 * 0 = esqueleto ("Carregando …"), 1 = "sem resposta, tentando de novo",
 * 2 = "ainda tentando" (o caso do projeto acordando de pausa, critério 7),
 * 3 = teto atingido, erro com saída.
 *
 * Duas fontes, e vale a MAIOR — mas elas não fazem a mesma coisa:
 *
 * - **A falha só sobe até o nível 1.** É a palavra do achado — *mentira* —
 *   virada regra: a tela nunca espera o relógio quando já sabe que uma
 *   tentativa falhou. Uma falha no primeiro instante derruba o "carregando" no
 *   primeiro instante.
 * - **O nível 2 é só do relógio.** O texto dele fala de DURAÇÃO ("ainda
 *   tentando… pode levar mais alguns segundos"), que é o caso do projeto
 *   acordando de pausa (critério 7). Contar falhas para chegar lá daria
 *   "ainda" aos 400 ms — e a home dispara várias leituras em paralelo, então
 *   duas falhas simultâneas não são dois ciclos, são um só visto duas vezes.
 *
 * O teto vence tudo: chegou lá, é erro, mesmo que nenhuma tentativa tenha
 * falhado ainda (o caso do pedido que simplesmente pendura).
 */
export function nivelDeEspera(decorridoMs: number, falhas: number): 0 | 1 | 2 | 3 {
  if (decorridoMs >= TETO_DE_LEITURA_MS) return 3;
  if (decorridoMs >= MS_ATE_SEGUNDO_AVISO) return 2;
  return decorridoMs >= MS_ATE_AVISAR || falhas >= 1 ? 1 : 0;
}

/** Métodos que podem ser repetidos sem duplicar nada. */
const METODOS_REPETIVEIS = ["GET", "HEAD", "OPTIONS"];

/**
 * Os mesmos status que o postgrest-js considera transitórios: 503 é o que o
 * PostgREST devolve quando não alcança o banco (e é o único 5xx falsificado no
 * E2E), 520 é a Cloudflare na frente do projeto hospedado.
 */
const STATUS_REPETIVEIS = [503, 520];

/**
 * Marca no `name` do erro — e, por consequência, no início da `message` que o
 * postgrest-js monta (`${name}: ${message}`) quando o fetch estoura.
 *
 * É por ela que `ehSemResposta` reconhece o caso depois que o erro atravessou a
 * biblioteca: o postgrest-js NÃO propaga a classe do erro de rede, ele devolve
 * um objeto simples `{ message, details, hint, code }`.
 */
export const MARCA_SEM_RESPOSTA = "SemRespostaDoServidor";

/**
 * Nenhuma resposta chegou: a conexão caiu, estourou o teto, ou o servidor
 * repetiu 503 até o fim das tentativas.
 *
 * ⚠️ A distinção que este tipo carrega é a do critério 6: em LEITURA ela vira
 * "não foi possível falar com o servidor"; em GRAVAÇÃO vira "não deu para
 * confirmar se isso foi salvo" — porque ninguém, nem o app, sabe se o servidor
 * chegou a efetivar. Erro COM resposta (validação, RLS, constraint) não passa
 * por aqui e continua podendo afirmar "não foi salvo".
 */
export class SemRespostaDoServidorError extends Error {
  constructor(motivo: string, opcoes?: { cause?: unknown }) {
    super(motivo, opcoes);
    this.name = MARCA_SEM_RESPOSTA;
  }
}

/**
 * Mensagens com que o browser relata falha de rede antes de qualquer resposta.
 * Cobrem o que NÃO passa por este módulo — o Storage, que sobe arquivo e por
 * isso fica fora do teto (upload de PDF em 4G leva mais que qualquer teto de
 * tela), e qualquer chamada que o SDK faça por conta própria.
 */
const FALHAS_DE_REDE_DO_BROWSER =
  /^(TypeError: )?(Failed to fetch|Load failed|NetworkError|Network request failed|network error|fetch failed)/i;

/** "Não houve resposta nenhuma" — o ramo 2 do Achado do spec de design. */
export function ehSemResposta(erro: unknown): boolean {
  if (erro instanceof SemRespostaDoServidorError) return true;
  const mensagem =
    typeof erro === "object" && erro !== null && "message" in erro
      ? (erro as { message?: unknown }).message
      : undefined;
  if (typeof mensagem !== "string") return false;
  if (mensagem.startsWith(`${MARCA_SEM_RESPOSTA}:`)) return true;
  if (mensagem.startsWith("AbortError:")) return true;
  return FALHAS_DE_REDE_DO_BROWSER.test(mensagem);
}

/**
 * Quem quer saber que UMA tentativa falhou — sem esperar o resultado final.
 *
 * É o sinal do critério 2 ("a tela nunca diz 'carregando' depois de saber que
 * uma tentativa falhou"). O aviso é do MÓDULO, não de uma requisição
 * específica: a tela que está carregando não tem como se identificar dentro do
 * `fetch`, e uma tentativa que falhou torna a frase "sem resposta do servidor"
 * verdadeira para qualquer tela aberta naquele instante. Quem escuta só escuta
 * enquanto está carregando (ver `Carregando`, em app/_components/ui.tsx).
 *
 * ⚠️ **Só LEITURA avisa** (Gate 2 do CONTAI-006). Como o aviso é do módulo e
 * não da requisição, ele troca o texto de QUALQUER `<Carregando>` montado
 * naquele instante — e o texto diz "sem resposta do servidor, tentando de
 * novo". Numa gravação as duas metades da frase são falsas: 503 numa escrita
 * TEVE resposta, e escrita não é repetida aqui por princípio. Deixar o aviso
 * na escrita fazia "Procurando agendamentos parecidos" e "Carregando os
 * pagamentos" — leituras vivas dentro do mesmo formulário — mentirem por causa
 * do POST ao lado.
 */
type Ouvinte = () => void;
const ouvintes = new Set<Ouvinte>();

export function observarTentativaSemResposta(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

function avisarTentativaSemResposta(): void {
  for (const ouvinte of [...ouvintes]) ouvinte();
}

function urlDaChamada(entrada: RequestInfo | URL): string {
  if (typeof entrada === "string") return entrada;
  if (entrada instanceof URL) return entrada.toString();
  return entrada.url;
}

/**
 * Só o PostgREST entra na política. O GoTrue fica FORA de propósito:
 * o `proxy.ts` já custa uma chamada por navegação (critério 9) e o auth-js
 * decide sozinho o que é erro repetível pelo TIPO do erro (`TypeError` vira
 * `AuthRetryableFetchError`) — embrulhar isso trocaria a mensagem de login por
 * uma genérica. O Storage também fica fora: lá o que trafega é o PDF da nota, e
 * teto de tela não serve para upload.
 */
function ehChamadaDeDados(url: string): boolean {
  return url.includes("/rest/v1/");
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Fetch = (
  entrada: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

/**
 * Uma tentativa, com teto próprio. Devolve a `Response` ou estoura.
 *
 * O `AbortController` é montado à mão em vez de `AbortSignal.any` +
 * `AbortSignal.timeout`: o alvo real é o WebKit do iPhone, e o que o E2E roda é
 * o mesmo motor — não vale a pena depender de API recente para economizar seis
 * linhas.
 */
async function umaTentativa(
  base: Fetch,
  entrada: RequestInfo | URL,
  init: RequestInit | undefined,
  limiteMs: number,
): Promise<Response> {
  const controle = new AbortController();
  const original = init?.signal;
  const abortar = () => controle.abort(original?.reason);
  if (original) {
    if (original.aborted) abortar();
    else original.addEventListener("abort", abortar, { once: true });
  }
  const relogio = setTimeout(() => {
    controle.abort(
      new SemRespostaDoServidorError(
        `Sem resposta do servidor em ${limiteMs} ms.`,
      ),
    );
  }, limiteMs);
  try {
    return await base(entrada, { ...init, signal: controle.signal });
  } finally {
    clearTimeout(relogio);
    original?.removeEventListener("abort", abortar);
  }
}

/**
 * O `fetch` que o client do Supabase usa para falar com o PostgREST.
 *
 * `agora` e `dormir` são injetáveis só para o teste unitário poder medir o
 * orçamento sem gastar segundos de relógio de verdade.
 */
export function criarFetchDeTela(
  base: Fetch = (entrada, init) => fetch(entrada, init),
  agora: () => number = () => Date.now(),
  dormir: (ms: number) => Promise<void> = esperar,
): Fetch {
  return async (entrada, init) => {
    const url = urlDaChamada(entrada);
    if (!ehChamadaDeDados(url)) return base(entrada, init);

    const metodo = (init?.method ?? "GET").toUpperCase();
    const repetivel = METODOS_REPETIVEIS.includes(metodo);
    const teto = repetivel ? TETO_DE_LEITURA_MS : TETO_DE_GRAVACAO_MS;
    const prazo = agora() + teto;

    let tentativa = 0;
    for (;;) {
      const restante = prazo - agora();
      if (restante <= 0) {
        if (repetivel) avisarTentativaSemResposta();
        throw new SemRespostaDoServidorError(
          `Sem resposta do servidor depois de ${teto} ms.`,
        );
      }
      const limite = repetivel ? Math.min(MS_POR_TENTATIVA, restante) : restante;

      let resposta: Response | null = null;
      let falha: unknown = null;
      try {
        resposta = await umaTentativa(base, entrada, init, limite);
      } catch (erro) {
        falha = erro;
      }

      // Cancelamento pedido por quem chamou (`.abortSignal()`) não é falha de
      // rede: não vira aviso de tela nem nova tentativa.
      if (falha !== null && init?.signal?.aborted) throw falha;

      const repetirPorStatus =
        resposta !== null && STATUS_REPETIVEIS.includes(resposta.status);
      if (resposta !== null && !repetirPorStatus) return resposta;

      // A partir daqui a tentativa falhou.
      if (!repetivel) {
        // Gravação não repete, e não avisa a tela: o aviso é do módulo e
        // mudaria o texto de leituras vivas em outros pontos da mesma página
        // (ver `observarTentativaSemResposta`). 503 numa escrita é RESPOSTA do
        // servidor: o chamador continua podendo afirmar "não foi salvo".
        if (resposta !== null) return resposta;
        throw falha instanceof SemRespostaDoServidorError
          ? falha
          : new SemRespostaDoServidorError(
              "Nenhuma resposta chegou do servidor.",
              { cause: falha },
            );
      }

      // Leitura: a tela precisa saber AGORA (critério 2), mesmo que ainda haja
      // tentativa por baixo.
      avisarTentativaSemResposta();

      if (resposta !== null) await resposta.text();

      const espera = ESPERAS_ENTRE_TENTATIVAS_MS[tentativa];
      const sobra = prazo - agora();
      if (espera === undefined || sobra <= espera) {
        throw new SemRespostaDoServidorError(
          `Sem resposta do servidor depois de ${tentativa + 1} tentativa(s).`,
          { cause: falha },
        );
      }
      await dormir(espera);
      tentativa += 1;
    }
  };
}
