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
 * `/` casa EXATO; as demais casam por prefixo.
 *
 * Prefixo e não igualdade porque `/obras/nova` e `/pendencias/[id]` são filhas
 * das views (ainda que morem no grupo `(captura)`): voltar de uma delas com o
 * menu apagado faria a tela parecer fora da navegação. `/` por igualdade
 * porque, por prefixo, ela casaria com tudo.
 */
export function ehViewAtiva(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
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
