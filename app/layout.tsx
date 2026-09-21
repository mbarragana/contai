import type { Metadata, Viewport } from "next";

import { PortaoSessao } from "@/app/_components/sessao";
import "./globals.css";

export const metadata: Metadata = {
  title: "contai",
  description: "Contabilidade fiscal da obra — documentos, pagamentos e acervo",
};

/**
 * 375px é o piso, não o alvo.
 *
 * Sem `maximumScale`/`userScalable` de propósito (CONTAI-014, critério 4):
 * travar a escala viola a WCAG 1.4.4, o iOS ignora a trava desde a v10 — só o
 * Android era punido — e a meta 3 do produto exige legibilidade verificada do
 * acervo, o que inclui dar zoom na foto de uma nota.
 *
 * ⚠️ Quem reintroduzir a trava aqui quebra `e2e/viewport.spec.ts`. E quem
 * pensar em reintroduzi-la para conter o auto-zoom do Safari: o auto-zoom não
 * se resolve aqui, se resolve mantendo TODO campo de digitação em 16px ou mais
 * (`app/globals.css` + `app/_components/campos.tsx`).
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/**
 * ⚠️ **A CASCA SAIU DAQUI — CONTAI-040.**
 *
 * Até o CONTAI-039 este layout carregava um `div` de 430px que valia para o app
 * inteiro, e a home pedia 1280px por um `:has([data-largo])` — hack de
 * declaração de largura pela página. O Mateus rejeitou o resultado ("várias
 * telas de celular lado a lado"), e o `cto-obra` fechou a separação por **ROUTE
 * GROUP**, não por breakpoint:
 *
 * - `app/(gestao)/` — a experiência de desktop (shell com sidebar), casca
 *   própria em `app/(gestao)/layout.tsx`;
 * - `app/(captura)/` — tudo que continua sendo fluxo de 430px, casca própria em
 *   `app/(captura)/layout.tsx`, **sem uma linha alterada** nas telas.
 *
 * Por isso a raiz agora só tem `<html>`, `<body>` e o portão de sessão: largura
 * é decisão de cada grupo, e não mais um atributo que uma página emite para a
 * casca de todo mundo.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="h-full">
        {/* Nenhuma tela do app abre sem sessão (CONTAI-002). O portão fica
            na raiz para valer em toda rota, inclusive nas que se abre por
            deep link do lembrete da agenda. */}
        <PortaoSessao>{children}</PortaoSessao>
      </body>
    </html>
  );
}
