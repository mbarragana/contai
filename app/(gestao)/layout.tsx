"use client";

import { ProvedorDeGestao } from "@/app/_components/gestao";
import { ShellDeGestao } from "@/app/_components/shell";

/**
 * **CONTAI-040 — a casca do grupo de gestão.**
 *
 * A separação mobile × desktop do produto é **estrutural, por rota**, e é aqui
 * que ela acontece: tudo sob `app/(gestao)/` — Visão geral, Despesas,
 * Pendências e Obras — abre dentro do shell; tudo sob `app/(captura)/` continua
 * nos 430px de sempre, sem sidebar nenhuma. A alternativa rejeitada
 * explicitamente pelo `cto-obra` no Gate 0 era duplicar a árvore de componentes
 * por `lg:`/media query dentro de uma página só — foi o que o `CONTAI-039`
 * tentou e o Mateus rejeitou.
 *
 * O provedor fica FORA do shell no aninhamento porque a sidebar também é
 * consumidora dele: obra aberta e badge de pendências saem do mesmo carregamento
 * que alimenta os painéis (Pre-mortem 3 do ticket).
 */
export default function GestaoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProvedorDeGestao>
      <ShellDeGestao>{children}</ShellDeGestao>
    </ProvedorDeGestao>
  );
}
