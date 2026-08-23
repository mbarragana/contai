"use client";

/**
 * O que a tela mostra quando a camada de dados falha — a tradução de erro
 * bruto (PostgREST, GoTrue, rede) para mensagem e para TIPO de erro.
 */

import { SemSessaoError } from "@/lib/supabase";

/**
 * Mensagem de erro para a UI, sem vazar detalhe técnico irrelevante.
 *
 * O PostgREST NÃO devolve `error` como `Error`: sem `throwOnError`, o que vem
 * é um objeto simples (`{ message, details, hint, code }`), e é ele que os
 * `throw error` daqui propagam. Só o ramo `instanceof Error` fazia toda
 * violação de RLS, de check constraint (`documento_quarentena_coerente`) e de
 * unicidade (`favorecido_dono_documento_unico`) chegar ao Mateus como "não foi
 * possível falar com o servidor" — ou seja, como problema de rede. Ele tentaria
 * de novo para sempre, e o registro nunca entraria.
 */
export function mensagemDeErro(erro: unknown): string {
  if (erro instanceof Error && erro.message) return erro.message;
  if (typeof erro === "object" && erro !== null && "message" in erro) {
    const { message } = erro as { message?: unknown };
    if (typeof message === "string" && message.trim() !== "") return message;
  }
  return "Não foi possível falar com o servidor. Tente de novo.";
}

/**
 * Critério 5 do CONTAI-002: "sem sessão" e "banco fora" NÃO são o mesmo erro.
 *
 * Os dois davam a mesma tela com o mesmo botão "Tentar de novo" — e tentar de
 * novo nunca resolveu falta de sessão: o Mateus ficaria batendo no botão até
 * desistir de registrar. Cada causa leva à ação que resolve ela (entrar de
 * novo × repetir a chamada), e quem decide isso é o TIPO do erro, nunca o
 * texto da mensagem.
 */
export type ErroDeTela =
  | { tipo: "sem_sessao" }
  | { tipo: "falha"; mensagem: string };

export function classificarErro(erro: unknown): ErroDeTela {
  if (erro instanceof SemSessaoError) return { tipo: "sem_sessao" };
  return { tipo: "falha", mensagem: mensagemDeErro(erro) };
}
