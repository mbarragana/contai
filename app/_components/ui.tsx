"use client";

/**
 * Peças visuais do mock v4 (design/mocks/CONTAI-001.html), mobile-first.
 * Alvos de toque ≥ 44px: canteiro, uma mão livre.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { urlDeEntrada } from "@/lib/auth";
import type { ErroDeTela } from "@/lib/data";

export function AppBar({ titulo, sub }: { titulo: string; sub?: string }) {
  return (
    <header className="flex-none border-b border-line px-[18px] pt-[14px] pb-[10px]">
      <h1 className="text-[16px] font-bold tracking-tight">{titulo}</h1>
      {sub ? <div className="mt-px text-[11.5px] text-mut">{sub}</div> : null}
    </header>
  );
}

export function Corpo({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 flex-col gap-3 overflow-y-auto px-[18px] py-4">
      {children}
    </main>
  );
}

/**
 * Rodapé fixo: fica FORA do `Corpo` (que rola), no fluxo normal, e por
 * construção não cobre conteúdo nenhum.
 *
 * `env(safe-area-inset-bottom)` somado ao padding: em PWA standalone e em
 * aparelho com notch, o rodapé encostaria na barra de gestos do iOS e o alvo
 * ficaria embaixo dela.
 */
export function Rodape({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-none flex-col gap-2 border-t border-line px-[18px] pt-3 pb-[calc(18px+env(safe-area-inset-bottom))]">
      {children}
    </div>
  );
}

/**
 * Barra fixa com "+ Adicionar" — critério 12 do CONTAI-018.
 *
 * Substitui o FAB `sticky bottom-0 mt-auto self-end` que existia SÓ na home.
 * O FAB morava DENTRO do `Corpo` (`overflow-y-auto` em `h-dvh`) e por isso
 * POUSAVA SOBRE O CONTEÚDO: na home cobria o acumulado da obra, e num detalhe
 * cobriria o botão de ação da tela. Esta barra usa o `Rodape`, que já é o
 * padrão de toda outra tela do app, está fora da área que rola e não pode
 * cobrir nada.
 *
 * Resolve as DUAS hipóteses do critério 12 de uma vez — "não renderiza no
 * aparelho dele" e "renderiza onde ele não olha" — sem depender de uma foto
 * da tela para escolher entre elas. E `/adicionar` passa a ser alcançável de
 * toda tela principal, não só da home: o relato ("não tem um link para
 * acessar a página /adicionar, o que é um absurdo") é sobre isso.
 */
export function BarraAdicionar({ voltar }: { voltar?: ReactNode }) {
  return (
    <Rodape>
      <div className="flex gap-2">
        {voltar ? <div className="flex-1">{voltar}</div> : null}
        <div className={voltar ? "flex-none" : "flex-1"}>
          <BotaoLink href="/adicionar">+ Adicionar</BotaoLink>
        </div>
      </div>
    </Rodape>
  );
}

export function Passo({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] tracking-[0.08em] text-mut uppercase">
      {children}
    </div>
  );
}

/**
 * `...resto` existe por um motivo específico, e não por generalidade: atributos
 * `data-*` em JSX **não são checados pelo TypeScript** (nome com hífen passa
 * sempre). Sem o spread, um `data-agendado` escrito aqui compilaria e sumiria
 * no runtime — e o E2E que procura por ele falharia sem explicação, do jeito
 * mais caro: parecendo bug da tela.
 */
export function Card({
  children,
  className = "",
  ...resto
}: {
  children: ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...resto}
      className={`rounded-[10px] border border-line bg-white px-[14px] py-3 ${className}`}
    >
      {children}
    </div>
  );
}

const CORES_CHIP = {
  red: "text-red bg-red-bg",
  amb: "text-amb bg-amb-bg",
  grn: "text-grn bg-grn-bg",
} as const;

const CORES_CHIP_VAZADO = {
  red: "text-red bg-transparent border border-red",
  amb: "text-amb bg-transparent border border-amb",
  grn: "text-grn bg-transparent border border-grn",
} as const;

export function Chip({
  cor,
  vazado = false,
  children,
}: {
  cor: keyof typeof CORES_CHIP;
  /**
   * Chip VAZADO — CONTAI-019, critério 8b: agendado aberto usa âmbar vazado e
   * o vencido usa âmbar PREENCHIDO.
   *
   * ⚠️ O preenchimento é o QUARTO canal de distinção, não o primeiro (decisão 2
   * do fechamento de 18/08): "sozinho é um canal só e falha no sol". O peso
   * está no texto do chip e em as três respostas existirem só no vencido. Aqui
   * ele é reforço.
   */
  vazado?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-block rounded-full px-[9px] py-0.5 text-[11px] font-semibold ${
        vazado ? CORES_CHIP_VAZADO[cor] : CORES_CHIP[cor]
      }`}
    >
      {children}
    </span>
  );
}

export function Consequencia({
  cor,
  children,
}: {
  cor: "red" | "amb";
  children: ReactNode;
}) {
  return (
    <p
      className={`mt-1.5 rounded-lg px-2.5 py-2 text-[12.5px] ${CORES_CHIP[cor]}`}
    >
      {children}
    </p>
  );
}

export function Banner({
  cor,
  children,
  role,
}: {
  cor: "red" | "amb" | "grn";
  children: ReactNode;
  role?: "alert" | "status";
}) {
  return (
    <div
      role={role}
      className={`rounded-[10px] px-[14px] py-3 text-[13.5px] ${CORES_CHIP[cor]}`}
    >
      {children}
    </div>
  );
}

export function Linha({
  rotulo,
  children,
}: {
  rotulo: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-[9px] last:border-b-0">
      <span className="flex-none text-[12px] text-mut">{rotulo}</span>
      <span className="text-right text-[13.5px]">{children}</span>
    </div>
  );
}

export function Dica({ children }: { children: ReactNode }) {
  return <p className="text-[12px] text-mut">{children}</p>;
}

const CORES_BOTAO = {
  primary: "bg-ink text-paper border-transparent",
  ghost: "bg-transparent text-ink border-line",
} as const;

type VarianteBotao = keyof typeof CORES_BOTAO;

const BASE_BOTAO =
  "block w-full min-h-[44px] rounded-[10px] border px-[14px] py-[13px] text-center text-[14.5px] font-semibold disabled:opacity-50";

export function Botao({
  variante = "primary",
  children,
  ...props
}: {
  variante?: VarianteBotao;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`${BASE_BOTAO} ${CORES_BOTAO[variante]} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function BotaoLink({
  href,
  variante = "ghost",
  children,
}: {
  href: string;
  variante?: VarianteBotao;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`${BASE_BOTAO} ${CORES_BOTAO[variante]}`}>
      {children}
    </Link>
  );
}

/** Estado de carregando — esqueleto do mock. */
export function Carregando({ rotulo }: { rotulo: string }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label={rotulo}>
      <div className="skel h-[13px] w-[70%]" />
      <div className="skel h-[13px] w-[90%]" />
      <div className="skel h-[13px] w-[55%]" />
      <div className="skel h-[13px] w-[80%]" />
    </div>
  );
}

/**
 * Estado de erro — sempre com saída, nunca tela morta.
 *
 * Tela 5 do mock CONTAI-002: "sem sessão" e "banco fora" são DOIS erros, com
 * duas saídas. Botão "Tentar de novo" em cima de falta de sessão é uma porta
 * que não abre — quem bate nela três vezes desiste de registrar a nota, e
 * custo não comprovado não existe na declaração.
 */
export function EstadoErro({
  erro,
  onTentarDeNovo,
}: {
  erro: ErroDeTela;
  onTentarDeNovo?: () => void;
}) {
  // `usePathname` e não `window.location`: seguro no render do servidor. A
  // query string do deep link é preservada pelo portão de sessão, que roda no
  // browser (app/_components/sessao.tsx).
  const caminho = usePathname();

  if (erro.tipo === "sem_sessao") {
    return (
      <Card>
        <Chip cor="amb">Sua sessão terminou</Chip>
        <Consequencia cor="amb">
          Entre de novo para ver a obra. Nada foi perdido: seus documentos e
          pagamentos continuam guardados.
        </Consequencia>
        <div className="mt-2.5">
          <BotaoLink href={urlDeEntrada(caminho)}>Entrar</BotaoLink>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Banner cor="red" role="alert">
        {erro.mensagem}
      </Banner>
      {onTentarDeNovo ? (
        <Botao variante="ghost" onClick={onTentarDeNovo}>
          Tentar de novo
        </Botao>
      ) : null}
    </div>
  );
}
