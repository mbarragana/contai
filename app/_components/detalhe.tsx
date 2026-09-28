"use client";

/**
 * **CONTAI-043 — as três peças de casca das telas de DETALHE dentro do shell.**
 *
 * Fonte do desenho: `design/mocks/detalhe-no-shell-v1.md` (decisões 1 a 5) e o
 * protótipo `design/mocks/detalhe-no-shell-v1.html`.
 *
 * Elas substituem, uma a uma, as peças da casca de 430px de `(captura)`:
 *
 * | 430px (`app/_components/ui.tsx`) | shell (aqui)        |
 * |---|---|
 * | `AppBar`                         | `CabecalhoDaTela`   |
 * | `Corpo`                          | `ColunaDeDetalhe`   |
 * | `Rodape` / `BarraAdicionar`      | `RodapeDeAcao` — ou NADA |
 *
 * ⚠️ **Nenhuma delas muda conteúdo.** Card, Chip, Consequencia, Linha e Dica
 * continuam sendo os mesmos de `ui.tsx`, com o mesmo texto: o critério 3 do
 * ticket é que nenhuma palavra de consequência fiscal seja reescrita, e a
 * maneira de garantir isso é a casca não saber o que há dentro dela.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** O que uma tela de detalhe empresta ao topbar do shell. */
export interface CabecalhoDaTelaAtual {
  titulo: string;
  sub?: string;
}

interface ContextoDeCabecalho {
  cabecalho: CabecalhoDaTelaAtual | null;
  definir: (c: CabecalhoDaTelaAtual | null) => void;
  /**
   * **CONTAI-077 — onde o `RodapeDeAcao` vai morar: fora do `<main>` rolável.**
   * O shell publica o nó aqui (ref callback); `null` = fora do shell, e o
   * rodapé volta a renderizar inline.
   */
  slotDoRodape: HTMLElement | null;
  publicarSlotDoRodape: (no: HTMLElement | null) => void;
}

const Contexto = createContext<ContextoDeCabecalho>({
  cabecalho: null,
  definir: () => {},
  slotDoRodape: null,
  publicarSlotDoRodape: () => {},
});

/** Lido SÓ pelo `ShellDeGestao` — é ele que desenha o topbar. */
export function useCabecalhoDaTela(): CabecalhoDaTelaAtual | null {
  return useContext(Contexto).cabecalho;
}

/**
 * Usado SÓ pelo `ShellDeGestao`, como `ref` do slot irmão do `<main>`
 * (CONTAI-077). É o setter de `useState`, logo tem identidade estável: ref
 * callback que muda de identidade a cada render seria desmontado e remontado
 * sem parar.
 */
export function usePublicarSlotDoRodape(): (no: HTMLElement | null) => void {
  return useContext(Contexto).publicarSlotDoRodape;
}

export function ProvedorDeCabecalho({ children }: { children: ReactNode }) {
  const [cabecalho, definir] = useState<CabecalhoDaTelaAtual | null>(null);
  const [slotDoRodape, publicarSlotDoRodape] = useState<HTMLElement | null>(
    null,
  );
  return (
    <Contexto.Provider
      value={{ cabecalho, definir, slotDoRodape, publicarSlotDoRodape }}
    >
      {children}
    </Contexto.Provider>
  );
}

/**
 * **O título da tela, emprestado ao topbar do shell** (decisão 3 do spec: o
 * detalhe não desenha um segundo cabeçalho dentro do conteúdo — ele usa o que
 * já existe).
 *
 * ⚠️ **Por que contexto e não `tituloDaView(pathname)`.** O título destas telas
 * é DADO, não rota: "NF de serviço · Construtora Silva" só se sabe depois de
 * carregar o documento, e "Corrigido ✓" depois de gravar. Uma tabela de rota →
 * título teria de repetir aqui a lógica de fase de cada tela, e divergiria na
 * primeira delas que mudasse.
 *
 * Renderiza `null`: o que ele faz é publicar o par título/sub. Ao desmontar,
 * devolve o topbar para `tituloDaView`/`subtituloDaView` — o cabeçalho de uma
 * tela não pode sobreviver à saída dela.
 */
export function CabecalhoDaTela({ titulo, sub }: CabecalhoDaTelaAtual) {
  const { definir } = useContext(Contexto);
  useEffect(() => {
    definir({ titulo, sub });
    return () => definir(null);
  }, [definir, titulo, sub]);
  return null;
}

/**
 * **A coluna de conteúdo: 640px, alinhada à esquerda** (decisão 2 do spec).
 *
 * ⚠️ **Não é full-width, e isso não é preferência de estilo.** O Gate 2 do
 * `CONTAI-039` mediu formulário/detalhe esticado por 1244px como **menos**
 * legível que os 430px de então; o `CONTAI-040` registrou o achado e este
 * ticket o executa. 640px e não os ~560px que o `cto-obra` cogitou porque os
 * grupos de `Escolha` quebram menos linha nessa largura (spec, decisão 2).
 *
 * O espaço à direita fica deliberadamente vazio: é ele que diz
 * "documento/formulário", e não "dashboard".
 *
 * `gap-3` é o MESMO espaçamento do `Corpo` de 430px — a moldura muda, o ritmo
 * interno das telas não.
 */
export function ColunaDeDetalhe({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-coluna="detalhe"
      className={`flex w-full max-w-[640px] flex-col gap-3 ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * **O rodapé da ação principal — fora da área rolável, e escopado à coluna de
 * 640px.**
 *
 * ⚠️ **Só existe onde a tela tem UMA ação de PÁGINA** (decisão 4 do spec):
 * gravar a correção, ligar os pagamentos, desligar o pagamento, confirmar o
 * arquivo. Tela de LEITURA com várias ações pequenas espalhadas em cards
 * (`/documento/[id]`, `/documento/[id]/cnpj-errado`) **não tem rodapé** — cada
 * ação fica no fim do card a que pertence, que é o que a doutrina
 * "consequência nunca atrás de clique" já pede: a ação certa ao lado do fato
 * certo.
 *
 * ⚠️ **O "Voltar" fixo não mora mais aqui.** No shell ele virou o breadcrumb do
 * topbar (`migalhaDaRota`, `lib/gestao/navegacao.ts`) — *muda de lugar, não se
 * duplica*. O que continua no rodapé é "Cancelar"/"Voltar sem gravar" ao lado
 * do Salvar, porque desistir é parte do formulário, não navegação do shell.
 *
 * Alcançável sem rolar até o fim, porque o formulário cresce com as pendências
 * acima dele. `max-w` repetido aqui (o mock faz o mesmo) mantém o rodapé na
 * largura da coluna mesmo quando ele é irmão dela, e nunca sob a sidebar.
 *
 * ══ CONTAI-077 — ele deixou de ser `sticky` DENTRO do `<main>` ═════════════
 *
 * Era `sticky bottom-0` dentro do `<main overflow-y-auto>` do shell, e sticky
 * em fluxo **sobrepõe** o conteúdo que rola por baixo: numa lista longa
 * (`/documento/[id]/ligar` com 24 candidatos) as últimas linhas visíveis
 * ficavam escondidas atrás dele durante todo o scroll intermediário, e só
 * "soltavam" no fim de verdade da lista. O Mateus reportou como *"o scroll tá
 * quebrado"*.
 *
 * Agora ele renderiza por **portal** num slot que o `ShellDeGestao` publica
 * como IRMÃO do `<main>` — o mesmo princípio que a casca de 430px
 * (`(captura)/layout.tsx` + `Rodape` de `ui.tsx`) sempre usou: quem rola é o
 * corpo, não a página, e o rodapé está fora da área que rola, logo não pode
 * cobrir nada por construção. `padding-bottom` no `main` não resolveria: criaria
 * um buraco da altura do rodapé no fim das 22 telas e deixaria o meio do scroll
 * como está.
 *
 * ⚠️ **O slot dá a goteira (`px-[18px] lg:px-9`), o rodapé dá o teto
 * (`max-w-[640px]`)** — exatamente a divisão que `main` + `ColunaDeDetalhe` já
 * fazem, e é ela que mantém rodapé e coluna com a MESMA largura e o MESMO `x`.
 * Repetir o `max-w` no slot capá-lo-ia a 604px (goteira dentro da caixa).
 *
 * ⚠️ **Sem slot no contexto → inline, `sticky`, como antes.** Vale no SSR (o
 * nó ainda não existe) e fora do shell. Nenhuma tela depende disso hoje, mas o
 * componente não pode quebrar se usado assim.
 *
 * **Efeito colateral aceito, não regressão** (critério 7): em tela com pouco
 * conteúdo sobra espaço vazio entre o último card e o rodapé, que fica no pé da
 * viewport — é o que a casca de 430px faz desde sempre.
 */
export function RodapeDeAcao({ children }: { children: ReactNode }) {
  const { slotDoRodape } = useContext(Contexto);

  const caixa = (
    <div
      data-rodape="acao"
      className={`flex w-full max-w-[640px] flex-none flex-col gap-2 border-t border-line bg-paper pt-3.5 pb-[calc(10px+env(safe-area-inset-bottom))] shadow-[0_-8px_16px_-8px_rgba(35,34,29,.08)] ${
        // Fora do slot ele volta a ser sticky no próprio fluxo: é a única forma
        // de continuar alcançável quando não há slot para habitar.
        slotDoRodape === null ? "sticky bottom-0 z-10" : ""
      }`}
    >
      {children}
    </div>
  );

  return slotDoRodape === null ? caixa : createPortal(caixa, slotDoRodape);
}
