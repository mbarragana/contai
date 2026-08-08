/**
 * Peças visuais do mock v4 (design/mocks/CONTAI-001.html), mobile-first.
 * Alvos de toque ≥ 44px: canteiro, uma mão livre.
 */

import Link from "next/link";
import type { ReactNode } from "react";

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

export function Rodape({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-none flex-col gap-2 border-t border-line px-[18px] pt-3 pb-[18px]">
      {children}
    </div>
  );
}

export function Passo({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] tracking-[0.08em] text-mut uppercase">
      {children}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
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

export function Chip({
  cor,
  children,
}: {
  cor: keyof typeof CORES_CHIP;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-block rounded-full px-[9px] py-0.5 text-[11px] font-semibold ${CORES_CHIP[cor]}`}
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

/** Estado de erro — sempre com saída, nunca tela morta. */
export function EstadoErro({
  mensagem,
  onTentarDeNovo,
}: {
  mensagem: string;
  onTentarDeNovo?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Banner cor="red" role="alert">
        {mensagem}
      </Banner>
      {onTentarDeNovo ? (
        <Botao variante="ghost" onClick={onTentarDeNovo}>
          Tentar de novo
        </Botao>
      ) : null}
    </div>
  );
}
