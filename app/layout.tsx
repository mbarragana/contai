import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "contai",
  description: "Contabilidade fiscal da obra — documentos, pagamentos e acervo",
};

// Cenário primário: celular no canteiro, uma mão livre (375px).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="h-full">
        {/* Altura fixa: quem rola é o corpo da tela, não a página — o rodapé
            com a ação principal fica sempre ao alcance do polegar. */}
        <div className="mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden">
          {children}
        </div>
      </body>
    </html>
  );
}
