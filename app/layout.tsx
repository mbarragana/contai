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
            com a ação principal fica sempre ao alcance do polegar.

            ⚠️ **A LARGURA É OPT-IN: quem declara que é larga é a PÁGINA, não
            a casca** (Gate 2 do CONTAI-039). 430px é o padrão de TODA tela;
            só abre para 1280px quando alguma descendente marca `data-largo`
            — hoje, só a home em estado pronto (`app/page.tsx`).

            Foi medido no review: com `lg:max-w-` incondicional, as telas de
            captura (`/adicionar/*`) e as de detalhe esticavam para ~1244px em
            COLUNA ÚNICA, e o texto de `Consequencia` ficava MENOS legível que
            nos 430px centrados de hoje. Texto fiscal perdendo legibilidade é
            regressão, não neutralidade.

            O número vem do spec de design: 1280 − 36 de padding = 1244 →
            aside 400 + gap-8 + `Secao` 812, com cada coluna da fila em
            ~398px, praticamente a largura do card de hoje. Com 1120px a
            coluna cairia a ~332px, MAIS ESTREITA que o celular.

            ⚠️ `:has()` é Safari 15.4+. Sem suporte, a regra simplesmente não
            casa e a tela fica nos 430px de sempre — degrada para o piso, não
            para layout quebrado.

            ⚠️ Mudou aqui, muda em `app/page.tsx` (`data-largo` no `Corpo`,
            aside `lg:w-[400px]`, `lg:gap-8`) e na `BarraAdicionar`
            (`alinharComFila`, `app/_components/ui.tsx`) — Tailwind exige
            string literal, então a sincronia é por comentário cruzado
            (Pre-mortem 3). */}
        <div className="mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden lg:has-[[data-largo]]:max-w-[1280px]">
          {/* Nenhuma tela do app abre sem sessão (CONTAI-002). O portão fica
              no layout para valer em toda rota, inclusive nas que se abre por
              deep link do lembrete da agenda. */}
          <PortaoSessao>{children}</PortaoSessao>
        </div>
      </body>
    </html>
  );
}
