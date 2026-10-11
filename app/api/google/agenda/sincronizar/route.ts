/**
 * **CONTAI-092 — a única porta de escrita no Google.**
 *
 * Dois alvos, uma função (critério 11):
 * - `{ compromissoId }` — depois de criar, adiar, corrigir, quitar ou cancelar
 *   um compromisso, e no "tentar de novo" do detalhe;
 * - `{ tudo: true }` — a **reconciliação sob demanda**: o botão "Sincronizar
 *   agora" de `/conta` e a abertura da Home (no máximo 1× por N horas por
 *   aparelho). Cobre o backfill dos compromissos que já existiam antes deste
 *   ticket, então não há migração de dados separada.
 *
 * ⚠️ **SEM CRON, e é decisão do `cto-obra`** (Out of Scope do ticket): no plano
 * Hobby da Vercel o cron é diário e exigiria segredo de cabeçalho + service key
 * — custo de infraestrutura desproporcional para um recurso que o próprio
 * ticket classifica como fora das três metas do produto. O preço é a dívida D-b:
 * lembrete perdido só se recupera quando o Mateus abre o app ou clica no botão.
 *
 * ⚠️ **A rota NUNCA é o caminho crítico de uma gravação** (critério 5): quem a
 * chama depois de salvar um compromisso o faz sem esperar e sem tratar o erro —
 * ver `sincronizarAgenda` em `lib/data.ts`. Ela também responde 200 (com
 * `situacao`) quando não há integração nem configuração, em vez de erro: "não
 * conectado" não é falha de ninguém.
 */

import { NextResponse } from "next/server";

import { sincronizar, type Alvo } from "@/lib/agenda/sincronizar";
import { usuarioDaRequisicao } from "@/lib/supabase-servidor";

/** `maxDuration` do plano Hobby. A reconciliação é sequencial e pode somar. */
export const maxDuration = 60;

function alvoDoCorpo(corpo: unknown): Alvo | null {
  if (typeof corpo !== "object" || corpo === null) return null;
  const c = corpo as { tudo?: unknown; compromissoId?: unknown };
  if (c.tudo === true) return { tudo: true };
  if (typeof c.compromissoId === "string" && c.compromissoId.length > 0) {
    return { compromissoId: c.compromissoId };
  }
  return null;
}

export async function POST(request: Request) {
  const autenticado = await usuarioDaRequisicao();
  if (!autenticado) {
    return NextResponse.json({ erro: "Sem sessão." }, { status: 401 });
  }

  const alvo = alvoDoCorpo(await request.json().catch(() => null));
  if (!alvo) {
    return NextResponse.json(
      { erro: "Informe `compromissoId` ou `tudo: true`." },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await sincronizar(autenticado.supabase, alvo));
  } catch (erro) {
    // Falha de BANCO (não do Google) — aqui sim é 500: a rota não conseguiu
    // nem ler o que deveria estar no calendário.
    console.warn(
      `[agenda] sincronização falhou: ${erro instanceof Error ? erro.message : String(erro)}`,
    );
    return NextResponse.json(
      { erro: "Não foi possível sincronizar agora." },
      { status: 500 },
    );
  }
}
