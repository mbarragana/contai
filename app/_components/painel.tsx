"use client";

/**
 * **CONTAI-040 — as peças do dashboard de gestão.**
 *
 * ⚠️ **Componentes NOVOS, não `Card` mobile redimensionado** (critério 8). O
 * `Card` de 430px, o headline de 26px e a `Consequencia` de 12.5px em bloco
 * estreito foram desenhados para o celular; reaproveitá-los numa tela larga foi
 * exatamente o que o `CONTAI-039` fez e o Mateus rejeitou ("várias telas de
 * celular lado a lado"). Aqui o número é 32px, o padding é 20-22px e a borda
 * superior de 3px carrega a cor da gravidade.
 *
 * ⚠️ **Nenhum texto fiscal nasce neste arquivo.** Estas são caixas; o que entra
 * dentro delas vem das constantes de sempre.
 */

import Link from "next/link";
import type { ReactNode } from "react";

const BORDA_DO_TILE = {
  red: "border-t-red",
  amb: "border-t-amb",
  grn: "border-t-grn",
} as const;

export const COR_DO_NUMERO = {
  red: "text-red",
  amb: "text-amb",
  grn: "text-grn",
} as const;

export type CorDoTile = keyof typeof BORDA_DO_TILE;

/** Um KPI do topo do dashboard. A borda superior é o canal de gravidade. */
export function Tile({
  cor,
  children,
  ...resto
}: {
  cor: CorDoTile;
  children: ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...resto}
      className={`rounded-[14px] border border-line border-t-[3px] bg-white px-[22px] py-5 ${BORDA_DO_TILE[cor]}`}
    >
      {children}
    </div>
  );
}

/** O rótulo acima do número — sempre com o nome da obra (crit. 9, CONTAI-003). */
export function TileRotulo({ children }: { children: ReactNode }) {
  return <div className="text-[12px] text-mut">{children}</div>;
}

/** O número do KPI: 32px, tabular, na cor da gravidade. */
export function TileNumero({
  cor,
  children,
}: {
  cor: CorDoTile;
  children: ReactNode;
}) {
  return (
    <div
      className={`mono mt-1 text-[32px] leading-tight font-bold tracking-[-0.02em] ${COR_DO_NUMERO[cor]}`}
    >
      {children}
    </div>
  );
}

/** Linha de apoio dentro do tile — mesma função da `Dica` no mobile. */
export function TileNota({ children }: { children: ReactNode }) {
  return <div className="mt-1.5 text-[12px] leading-[1.5] text-mut">{children}</div>;
}

/**
 * A decomposição do tile: mini-tabela separada por um filete.
 *
 * ⚠️ É a R4 do CONTAI-005 virando estrutura também aqui — *"o total nunca
 * aparece sem a decomposição visível"*.
 */
export function TileDecomposicao({ children }: { children: ReactNode }) {
  return (
    <div className="mt-2.5 border-t border-line pt-2.5 text-[12px] text-mut">
      {children}
    </div>
  );
}

export function TileLinha({
  rotulo,
  children,
}: {
  rotulo: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span>{rotulo}</span>
      <span className="mono font-semibold text-ink">{children}</span>
    </div>
  );
}

/**
 * Um painel do corpo do dashboard: título, link de "ver todas" e conteúdo.
 *
 * ⚠️ O link do cabeçalho leva à view que tem a lista INTEIRA. O painel é ponto
 * de partida, nunca substituto: quem esconde a mais grave atrás de um recorte
 * sem saída reencena a D47.
 */
export function Painel({
  titulo,
  descricao,
  verTodas,
  children,
  ...resto
}: {
  titulo: string;
  descricao?: ReactNode;
  verTodas?: { href: string; rotulo: string };
  children: ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      {...resto}
      className="rounded-[14px] border border-line bg-white px-5 py-[18px]"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[14.5px] font-semibold">{titulo}</h2>
        {verTodas ? (
          <Link
            href={verTodas.href}
            className="flex-none text-[12px] font-semibold text-mut hover:text-ink hover:underline"
          >
            {verTodas.rotulo}
          </Link>
        ) : null}
      </div>
      {descricao ? (
        <div className="mt-0.5 mb-3 text-[12px] text-mut">{descricao}</div>
      ) : null}
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

/** Uma linha compacta de lista dentro de um painel (despesa, compromisso). */
export function LinhaDoPainel({
  titulo,
  detalhe,
  valor,
  href,
}: {
  titulo: ReactNode;
  detalhe?: ReactNode;
  valor: ReactNode;
  href?: string;
}) {
  const conteudo = (
    <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2.5 text-[13px] last:border-b-0 last:pb-0">
      <div className="min-w-0">
        <div className="font-semibold">{titulo}</div>
        {detalhe ? (
          <div className="text-[11.5px] text-mut">{detalhe}</div>
        ) : null}
      </div>
      <div className="mono flex-none font-semibold whitespace-nowrap">
        {valor}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block hover:bg-soft">
      {conteudo}
    </Link>
  ) : (
    conteudo
  );
}
