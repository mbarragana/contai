"use client";

/**
 * **CONTAI-092, critério 11 — a reconciliação automática, SEM CRON.**
 *
 * No plano Hobby da Vercel o cron é diário e exigiria segredo de cabeçalho +
 * service key: custo de infraestrutura desproporcional para um recurso que o
 * próprio ticket classifica como fora das três metas do produto (Out of Scope).
 * O substituto é este: ao abrir a Home, **no máximo 1× por `HORAS_ENTRE_TENTATIVAS`
 * por aparelho**, o app pede ao servidor que reconcilie tudo.
 *
 * É também o BACKFILL dos compromissos que já existiam antes deste ticket — por
 * isso não há migração de dados separada (critério 11).
 *
 * ⚠️ **Não renderiza nada e não avisa nada.** Falha aqui é silenciosa de
 * propósito: a reconciliação não é um ato do Mateus, e um aviso de "não deu para
 * sincronizar" na abertura da Home seria ruído sobre uma conveniência — pior,
 * seria lido como problema com os pagamentos (Gate Fiscal 7b). Quem mostra o
 * estado da integração é o card de `/conta`, e o botão "Sincronizar agora" é o
 * caminho explícito quando ele quiser forçar.
 *
 * ⚠️ **A rota decide se há o que fazer**, não este componente: sem configuração
 * ou sem autorização ela responde na hora, sem tocar o Google (critérios 5 e
 * 15). Consultar o estado aqui antes de pedir a sincronização seria uma ida de
 * rede a mais para descobrir o que a própria chamada já resolve.
 */

import { useEffect } from "react";

import {
  CHAVE_RECONCILIACAO,
  deveReconciliar,
} from "@/lib/agenda/reconciliacao";
import { reconciliarAgenda } from "@/lib/data";

export function ReconciliacaoDaAgenda() {
  useEffect(() => {
    // Todo acesso ao localStorage em `try`: em aba privada do Safari ele lança,
    // e uma exceção aqui derrubaria a Home por causa de uma conveniência.
    let ultima: string | null = null;
    try {
      ultima = window.localStorage.getItem(CHAVE_RECONCILIACAO);
    } catch {
      // Sem memória de aparelho: tenta, e o throttle vale só para esta sessão.
    }
    if (!deveReconciliar(ultima, Date.now())) return;

    // Carimba ANTES de chamar, não depois: duas abas abertas ao mesmo tempo
    // mandariam duas requisições se o carimbo esperasse a resposta — e a
    // reconciliação é idempotente, então perder uma rodada por causa de uma
    // falha é mais barato do que duplicar a varredura.
    try {
      window.localStorage.setItem(CHAVE_RECONCILIACAO, String(Date.now()));
    } catch {
      // idem
    }

    void reconciliarAgenda().catch(() => {
      // Silêncio deliberado — ver o cabeçalho.
    });
  }, []);

  return null;
}
