"use client";

/**
 * O que a tela mostra quando a camada de dados falha — a tradução de erro
 * bruto (PostgREST, GoTrue, rede) para mensagem e para TIPO de erro.
 */

import { ehSemResposta } from "@/lib/rede";
import { SemSessaoError } from "@/lib/supabase";

/**
 * Teto de espera estourado, ou tentativas esgotadas, numa LEITURA de tela.
 * Repetir um GET é sempre seguro, então o texto pode convidar a repetir.
 * (CONTAI-006, critério 3 — texto do spec de design, copiado, não reescrito.)
 */
export const SEM_RESPOSTA_NA_LEITURA =
  "Não foi possível falar com o servidor depois de várias tentativas. " +
  "Verifique sua conexão e tente de novo.";

/**
 * ⚠️ O texto do critério 6, e a razão de ele existir.
 *
 * Até aqui, uma GRAVAÇÃO que falhou sem resposta nenhuma caía no mesmo
 * fallback da leitura — "Não foi possível falar com o servidor. Tente de novo."
 * —, que soa seguro e convida ao segundo toque. Só que ninguém sabe se o
 * servidor efetivou: o segundo toque é como nasce o registro duplicado, que é
 * a dor que o uso real produziu em 24 h. "Não sei se salvou" honesto é melhor
 * que um erro que induz o segundo toque.
 *
 * `onde` é a tela onde ele confere ANTES de repetir — quem chama preenche,
 * porque só a tela sabe onde o registro apareceria.
 */
const ABERTURA_INCERTA = "Não deu para confirmar se isso foi salvo.";

export function gravacaoIncerta(onde: string): string {
  return (
    `${ABERTURA_INCERTA} Antes de tentar de novo, ` +
    `confira ${onde} — repetir sem conferir pode duplicar o registro.`
  );
}

/**
 * A tela já montou a mensagem: esta gravação teve resultado INCERTO?
 *
 * Serve a um caso específico e recorrente no app: quase todo banner de falha
 * de gravação vem cercado de uma afirmação tranquilizadora — *"Nada foi
 * alterado — o que você preencheu continua aqui"*. Essa frase é verdadeira
 * quando o servidor RECUSOU, e é uma mentira nova quando ele não respondeu
 * nada. Quem a envolve (`ErroDeGravacao`, em app/_components/ui.tsx) usa isto
 * para calar a afirmação no caso incerto, em vez de repeti-la sem saber.
 */
export function gravacaoFoiIncerta(mensagem: string): boolean {
  return mensagem.startsWith(ABERTURA_INCERTA);
}

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
  // Antes do `instanceof Error`: o erro de rede embrulhado pelo postgrest-js
  // chega com uma `message` técnica ("SemRespostaDoServidor: …"), que sem este
  // ramo iria para a tela tal e qual.
  if (ehSemResposta(erro)) return SEM_RESPOSTA_NA_LEITURA;
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

/**
 * A mesma tradução, para o "Salvar" — CONTAI-006, critério 6.
 *
 * As duas categorias do Achado do spec de design:
 * 1. **Houve resposta recusando** (validação, RLS, constraint, 4xx/5xx com
 *    corpo) → é seguro afirmar "não foi salvo", com a mensagem específica.
 *    Cai em `mensagemDeErro`, sem mudança nenhuma.
 * 2. **Não houve resposta nenhuma** (conexão caiu, teto estourado) → resultado
 *    INCERTO, e a tela diz exatamente isso.
 *
 * Quem separa uma da outra é `lib/rede.ts`: só ele sabe se algum byte voltou.
 */
export function mensagemDeErroDeGravacao(erro: unknown, onde: string): string {
  if (ehSemResposta(erro)) return gravacaoIncerta(onde);
  return mensagemDeErro(erro);
}
