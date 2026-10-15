"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { carregarPapelDaSessao } from "@/lib/data";
import {
  ROTA_DO_COLABORADOR,
  ROTA_DO_DONO,
  type PapelDaSessao,
} from "@/lib/papel";

/**
 * **CONTAI-093, critério 16 — a guarda de rota dos dois shells.**
 *
 * Um componente para os dois layouts: `app/(gestao)/layout.tsx` espera `"dono"`
 * e manda o colaborador para `/colaborador`; `app/(colaborador)/layout.tsx`
 * espera `"colaborador"` e manda o dono para `/`. Vale também para navegação
 * direta de URL, porque é o LAYOUT do grupo que a monta — não um link.
 *
 * ⚠️ **Ela NÃO é a trava de segurança, e ler como se fosse é o erro caro.** O
 * que impede o colaborador de ver o acervo do Mateus é a RLS do Postgres
 * (migrations 0001 e 0030): mesmo que esta guarda falhe, seja contornada ou
 * demore, `/despesas` devolve lista vazia para quem não é dono. Esta guarda é
 * UX — ela existe para a pessoa não encarar uma tela vazia sem explicação.
 *
 * ⚠️ **Renderiza os filhos ANTES de saber o papel, de propósito.** A
 * alternativa — portão de carregamento em cima de `(gestao)` — somaria uma
 * leitura de banco bloqueante na frente de TODA tela de gestão do Mateus, que é
 * o uso real e diário do app, para proteger um caso que a RLS já cobre. O preço
 * aceito é o colaborador ver o esqueleto do shell de gestão por um instante
 * (com conteúdo vazio, pela RLS) antes de ser levado para a área dele.
 *
 * ⚠️ Falha de leitura NÃO redireciona: sessão caída é trabalho do
 * `PortaoSessao` (que já mostra o sobreposto de reautenticação), e banco fora
 * do ar não é motivo para jogar o Mateus num shell que não é o dele.
 */
export function GuardaDePapel({
  esperado,
  children,
}: {
  esperado: PapelDaSessao;
  children: ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const papel = await carregarPapelDaSessao();
        if (cancelado || papel === esperado) return;
        // `replace` e não `push`: o shell errado não pode ficar no histórico —
        // o "voltar" do navegador devolveria a pessoa exatamente para onde ela
        // não devia estar, num laço com esta guarda.
        router.replace(
          papel === "colaborador" ? ROTA_DO_COLABORADOR : ROTA_DO_DONO,
        );
      } catch {
        // Ver o ⚠️ do cabeçalho: silêncio aqui é a escolha certa.
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [esperado, router]);

  return <>{children}</>;
}
