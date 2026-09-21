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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="h-full">
        {/* Altura fixa: quem rola é o corpo da tela, não a página — o rodapé
            com a ação principal fica sempre ao alcance do polegar. */}
        <div className="mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden">
          {/* Nenhuma tela do app abre sem sessão (CONTAI-002). O portão fica
              no layout para valer em toda rota, inclusive nas que se abre por
              deep link do lembrete da agenda. */}
          <PortaoSessao>{children}</PortaoSessao>
        </div>
      </body>
    </html>
  );
}
