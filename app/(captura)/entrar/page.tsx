"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { FluxoEntrar } from "@/app/_components/entrar";
import { AppBar } from "@/app/_components/ui";
import { destinoSeguro, PARAM_DESTINO } from "@/lib/auth";

/**
 * Tela 1 do mock CONTAI-002. Única rota do app que não exige sessão.
 *
 * O destino vem de `window.location` e não de `useSearchParams` de propósito:
 * o app inteiro é client-side e `useSearchParams` obrigaria uma fronteira de
 * Suspense só para ler um parâmetro. `destinoSeguro` é quem decide se ele
 * presta — parâmetro de URL é entrada de terceiro, mesmo aqui.
 */
export default function Entrar() {
  const router = useRouter();
  // Lido uma vez, no primeiro render do browser. O destino não aparece em
  // lugar nenhum da tela — só é usado depois que a sessão nasce.
  const [destino] = useState(() =>
    typeof window === "undefined"
      ? "/"
      : destinoSeguro(
          new URLSearchParams(window.location.search).get(PARAM_DESTINO),
        ),
  );

  return (
    /**
     * ⚠️ **CONTAI-047, critério 6 — o login se AUTOLIMITA a 430px.**
     *
     * A casca do grupo `(captura)` abre para 940px a partir de `larga`, e esta
     * tela não quer isso: login esticado numa tela larga é regressão visual,
     * não ganho — são três campos e um botão, e nada neles fica melhor com
     * 900px. O wrapper é a "uma linha de CSS isolando essa rota" do ticket, e
     * está AQUI de propósito, não no `layout.tsx`: a exceção mora na tela que a
     * pede (Pre-mortem 4).
     *
     * `min-h-0` + `flex-1` porque a casca é `h-dvh` com `overflow-hidden`: sem
     * eles o `Corpo` do `FluxoEntrar` (que é quem rola) herdaria altura de
     * sobra e a tela pararia de rolar em janela baixa — foi o bug do
     * `min-h-0` do shell de gestão, com outra moldura.
     */
    <div className="mx-auto flex min-h-0 w-full max-w-[430px] flex-1 flex-col">
      <AppBar titulo="contai" sub="Entrar" />
      {/* Critério 4: volta para a rota pedida, não para a home — quem chega
          por um lembrete de boleto vem para pagar aquele boleto. */}
      <FluxoEntrar aoEntrar={() => router.replace(destino)} />
    </div>
  );
}
