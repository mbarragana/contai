/**
 * **CONTAI-040 — a navegação do shell de gestão, em função pura.**
 *
 * A sidebar (e a faixa estreita que a substitui abaixo do breakpoint) é a
 * MESMA lista em toda tela do grupo `app/(gestao)/`: *"nenhum item de navegação
 * nasce e morre a partir de conteúdo condicional"* (spec de design). Deixar a
 * lista aqui, fora do componente, é o que torna essa promessa verificável por
 * teste em vez de por leitura de JSX.
 *
 * ⚠️ **Nenhum texto fiscal mora neste arquivo.** Rótulo de menu e título de
 * view são copy de produto; o subtítulo de `/pendencias` é a frase que a própria
 * tela já dizia desde o `CONTAI-042`, repetida aqui porque é dela que o shell
 * tirou o `AppBar`.
 */

export interface ViewDeGestao {
  /** A rota real — o item do menu nunca aponta para lugar nenhum. */
  href: string;
  /** Rótulo no menu e título na barra superior: um nome só para a view. */
  rotulo: string;
}

/**
 * As quatro views de primeira classe, na ordem do desenho.
 *
 * ⚠️ `/despesas` existe de verdade desde este ticket e só ganha a TABELA no
 * `CONTAI-041` — o critério 1 exige o item no menu, e item de menu que não
 * abre nada é link morto.
 */
export const VIEWS_DE_GESTAO: readonly ViewDeGestao[] = [
  { href: "/", rotulo: "Visão geral" },
  { href: "/despesas", rotulo: "Despesas" },
  { href: "/pendencias", rotulo: "Pendências" },
  { href: "/obras", rotulo: "Obras" },
] as const;

export interface OpcaoDeRegistro {
  href: string;
  rotulo: string;
  descricao: string;
}

/**
 * **As três portas de captura, como o topbar do shell as oferece.**
 *
 * ⚠️ **Cópia literal dos rótulos e descrições de
 * `app/(captura)/adicionar/page.tsx`** — exigência do critério 5 do
 * `CONTAI-040`, e é copy de produto, não texto fiscal (decisão de design, não
 * parecer).
 *
 * ⚠️ **A duplicação é obrigatória e é TRAVADA, não confiada à atenção.** O
 * critério 7 do mesmo ticket diz que `/adicionar/*` **não muda em nenhuma
 * linha**, então extrair estas frases para cá e importá-las lá está proibido
 * nesta rodada. O que fecha o buraco é `navegacao.test.ts`: ele lê aquele
 * arquivo e exige que cada rótulo e cada descrição abaixo exista **verbatim**
 * nele. Divergir deixa a suíte vermelha com o nome da frase — mesma malha dos
 * testes-trava de `lib/fiscal`.
 */
export const OPCOES_DE_REGISTRO: readonly OpcaoDeRegistro[] = [
  {
    href: "/adicionar/documento",
    rotulo: "📄 Documento — PDF, XML ou foto",
    descricao:
      "Nota ou boleto que chegou no WhatsApp/e-mail. O arquivo fica no acervo; você preenche os campos (extração automática: fase 2).",
  },
  {
    href: "/adicionar/pagamento",
    rotulo: "💸 Pagamento",
    descricao:
      "O dinheiro que saiu da conta — PIX com comprovante. A data do pagamento é o que define o ano do custo (regime de caixa).",
  },
  {
    href: "/adicionar/compra-cartao",
    rotulo: "💳 Compra no cartão",
    descricao:
      "Nasce sempre agendamento — o custo só entra quando a fatura for paga, uma compra de cada vez (CONTAI-022).",
  },
] as const;

/**
 * **CONTAI-043 — as rotas de DETALHE que pertencem a uma view sem morar sob o
 * href dela.**
 *
 * `/documento/[id]` é uma despesa aberta a partir de Despesas, do dashboard ou
 * da fila de pendências, mas a rota não começa por `/despesas`. Sem esta
 * tabela, abrir um documento apagaria a sidebar inteira — a tela pareceria
 * fora da navegação no meio da revisão que o shell existe para dar.
 *
 * Atribuição fixada no spec de design (`detalhe-no-shell-v1.md`, decisão 1):
 * `/documento`, `/pagamento` e `/fatura` → **Despesas**.
 *
 * ⚠️ **CONTAI-044** acrescenta `/pagamento` e `/fatura` — as duas entram
 * juntas no mesmo prefixo `/despesas` porque um PIX/boleto direto e uma
 * compra no cartão são a mesma despesa da meta 1, só com origem diferente
 * (`resumo.despesas[].href` já aponta para as duas desde o `CONTAI-041`).
 *
 * ⚠️ **CONTAI-045** acrescenta `/compromisso` → **Visão geral** (spec de
 * design, decisão 1: é lá que a Agenda vive hoje). O prefixo vem **sem barra
 * final** de propósito: a lista `/compromisso` é rota de verdade — o destino do
 * "ver todos (N)" — e ela pertence à mesma view que o detalhe dela.
 * `/pendencias/[id]` não precisa de linha nenhuma: a rota já começa pelo href
 * da view, e o casamento por prefixo resolve.
 */
const VIEW_DA_ROTA_DE_DETALHE: readonly (readonly [string, string])[] = [
  ["/documento/", "/despesas"],
  ["/pagamento/", "/despesas"],
  ["/fatura/", "/despesas"],
  ["/compromisso", "/"],
] as const;

/** A view a que a rota pertence — ela mesma, ou a dona do detalhe aberto. */
function viewDaRota(pathname: string): string {
  for (const [prefixo, view] of VIEW_DA_ROTA_DE_DETALHE) {
    if (pathname.startsWith(prefixo)) return view;
  }
  return pathname;
}

/**
 * `/` casa EXATO; as demais casam por prefixo.
 *
 * Prefixo e não igualdade porque `/obras/nova` e `/pendencias/[id]` são filhas
 * das views (ainda que morem no grupo `(captura)`): voltar de uma delas com o
 * menu apagado faria a tela parecer fora da navegação. `/` por igualdade
 * porque, por prefixo, ela casaria com tudo.
 */
export function ehViewAtiva(pathname: string, href: string): boolean {
  const view = viewDaRota(pathname);
  return href === "/" ? view === "/" : view.startsWith(href);
}

export interface MigalhaDeRota {
  href: string;
  rotulo: string;
}

/**
 * **O breadcrumb do topbar — CONTAI-043, decisão 3 do spec de design.**
 *
 * Dentro do shell, o botão fixo "Voltar ao início"/"Voltar ao documento" do
 * rodapé de 430px **muda de lugar, não se duplica**: vira uma linha pequena
 * acima do H1.
 *
 * ⚠️ **Sempre uma ROTA CANÔNICA, nunca "histórico do navegador".** Voltar por
 * histórico quebra em link direto e em refresh — e link direto é o caso normal
 * aqui: a pendência do dashboard, o lembrete da agenda e o item de `/despesas`
 * abrem o detalhe de fora.
 *
 * Duas camadas, e a segunda é a aplicação da mesma regra um nível abaixo:
 * - `/documento/[id]` (ou `/pagamento/[id]`, `/fatura/[id]`) → a lista-mãe,
 *   **Despesas**;
 * - `/documento/[id]/<qualquer coisa>` → o documento de onde a correção saiu
 *   (idem pagamento/fatura). A mãe de `corrigir/valor` é o documento, que é
 *   rota de verdade — não é o histórico disfarçado.
 *
 * ⚠️ **CONTAI-044** generaliza a raiz única (`documento`) para uma tabela:
 * `/pagamento/[id]/ligar` e `/fatura/[id]/alocar` voltam para o PAGAMENTO e a
 * FATURA de origem, nunca para `/despesas` direto — mesma regra "um nível
 * abaixo" do documento, com o rótulo do tipo certo.
 *
 * ⚠️ **CONTAI-045** acrescenta `compromisso` e `pendencias`, e com eles a
 * lista-mãe deixa de ser sempre `/despesas`:
 * - `/compromisso/[id]` volta para a AGENDA (`/compromisso`), que é rota de
 *   verdade, e a agenda volta para a **Visão geral**, de onde se chega nela;
 * - `/pendencias/[id]` volta para `/pendencias` — **nunca** para a home antiga,
 *   que deixou de existir no `CONTAI-040` (Pre-mortem 2 do ticket).
 */
interface RaizDeDetalhe {
  /** O rótulo do próprio registro — é o que a SUBROTA mostra no crumb. */
  rotulo: string;
  /** A lista-mãe do detalhe: para onde `/<raiz>/<id>` volta. */
  mae: MigalhaDeRota;
  /**
   * Para onde a própria raiz volta, quando ela é rota de verdade e não é view
   * de primeira classe. Só `/compromisso` hoje: `/pendencias` é view (o topo da
   * navegação não tem para onde voltar) e `/documento`, `/pagamento` e
   * `/fatura` não existem sem id.
   */
  daRaiz?: MigalhaDeRota;
}

const DESPESAS: MigalhaDeRota = { href: "/despesas", rotulo: "Despesas" };

const RAIZES_DE_DETALHE: Readonly<Record<string, RaizDeDetalhe>> = {
  documento: { rotulo: "Documento", mae: DESPESAS },
  pagamento: { rotulo: "Pagamento", mae: DESPESAS },
  fatura: { rotulo: "Fatura", mae: DESPESAS },
  compromisso: {
    rotulo: "Agendamento",
    mae: { href: "/compromisso", rotulo: "Agendados" },
    daRaiz: { href: "/", rotulo: "Visão geral" },
  },
  pendencias: {
    rotulo: "Pendência",
    mae: { href: "/pendencias", rotulo: "Pendências" },
  },
};

export function migalhaDaRota(pathname: string): MigalhaDeRota | null {
  const partes = pathname.split("/").filter((p) => p !== "");
  const raiz = partes[0];
  const entrada = raiz === undefined ? undefined : RAIZES_DE_DETALHE[raiz];
  if (!entrada) return null;
  if (partes.length === 1) return entrada.daRaiz ?? null;
  if (partes.length === 2) return entrada.mae;
  return { href: `/${raiz}/${partes[1]}`, rotulo: entrada.rotulo };
}

/** O título da barra superior. Sem view casada, a marca. */
export function tituloDaView(pathname: string): string {
  return (
    VIEWS_DE_GESTAO.find((v) => ehViewAtiva(pathname, v.href))?.rotulo ??
    "contai"
  );
}

export interface ContextoDoSubtitulo {
  nomeDaObra: string | null;
  ano: number | null;
  /**
   * Vermelhas + âmbares (`PendenciasUnificadas.abertas`). `null` enquanto a
   * carga não terminou — número não apurado não pode aparecer como apuração.
   */
  abertas: number | null;
}

/**
 * ⚠️ A frase de `/pendencias` é a que a tela já dizia no `AppBar` desde o
 * `CONTAI-042`, e ela não é decorativa: distingue a pendência DERIVADA (some
 * quando o fato muda) da PERSISTENTE (só sai com um desfecho escolhido). Quem
 * encurtar isso para "N abertas" apaga a diferença.
 */
export function subtituloDaView(
  pathname: string,
  ctx: ContextoDoSubtitulo,
): string | null {
  if (ehViewAtiva(pathname, "/pendencias")) {
    const contagem =
      ctx.abertas === null
        ? ""
        : `${ctx.abertas} ${ctx.abertas === 1 ? "aberta" : "abertas"} · `;
    return `${contagem}as derivadas somem quando o fato muda; as de correção, só com um desfecho escolhido`;
  }
  if (ehViewAtiva(pathname, "/obras")) return "Escolha em qual você vai mexer";
  // Visão geral e Despesas são recortadas por ano-calendário: as duas nomeiam
  // a obra e o ano, porque todo número delas é daquela obra naquele ano.
  if (ctx.nomeDaObra === null) return null;
  return `${ctx.nomeDaObra}${ctx.ano === null ? "" : ` · ${ctx.ano}`}`;
}
