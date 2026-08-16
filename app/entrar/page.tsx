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
  // lugar nenhum da tela — só é usado depois que o código é aceito.
  const [destino] = useState(() =>
    typeof window === "undefined"
      ? "/"
      : destinoSeguro(
          new URLSearchParams(window.location.search).get(PARAM_DESTINO),
        ),
  );

  return (
    <>
      <AppBar titulo="contai" sub="Entrar" />
      {/* Critério 4: volta para a rota pedida, não para a home — quem chega
          por um lembrete de boleto vem para pagar aquele boleto. */}
      <FluxoEntrar aoEntrar={() => router.replace(destino)} />
    </>
  );
}
