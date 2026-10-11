/**
 * **CONTAI-092, critério 17 — o começo do consentimento.**
 *
 * `GET` e não `POST` porque o resultado é uma NAVEGAÇÃO de página inteira: o
 * botão de `/conta` manda o browser para cá, e daqui ele sai para o Google. Um
 * `fetch` não serviria — a tela de consentimento tem de aparecer na barra de
 * endereço do Mateus, com o domínio do Google à vista, que é o que lhe permite
 * conferir a quem ele está dando acesso.
 *
 * O que esta rota NÃO faz: não grava nada em `integracao_google` (quem grava é o
 * callback, depois do consentimento) e não toca o Google (só redireciona).
 */

import { NextResponse } from "next/server";

import { configDoGoogle } from "@/lib/agenda/config";
import {
  COOKIE_STATE,
  VALIDADE_STATE_SEGUNDOS,
  gerarState,
  urlDeConsentimento,
} from "@/lib/agenda/oauth";
import { usuarioDaRequisicao } from "@/lib/supabase-servidor";

export async function GET() {
  // ⚠️ Sessão conferida AQUI, com 401 próprio (dívida D-c): o `proxy.ts` protege
  // rota de tela por redirect 307 para `/entrar`, que para uma rota de API
  // devolveria HTML de login com status 200.
  const autenticado = await usuarioDaRequisicao();
  if (!autenticado) {
    return NextResponse.json({ erro: "Sem sessão." }, { status: 401 });
  }

  const config = configDoGoogle();
  if (!config) {
    // Critério 15: sem as variáveis, nenhuma rota chama o Google. O card já
    // mostra "Não configurado", então aqui só pode ser URL digitada à mão.
    return NextResponse.json(
      { erro: "Integração com o Google Agenda não está configurada." },
      { status: 503 },
    );
  }

  const state = gerarState();
  const resposta = NextResponse.redirect(urlDeConsentimento(config, state));
  resposta.cookies.set(COOKIE_STATE, state, {
    httpOnly: true,
    sameSite: "lax",
    // `secure` fora de desenvolvimento: em produção o app é https, e cookie de
    // nonce sem `secure` viajaria em claro se alguém abrisse por http.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VALIDADE_STATE_SEGUNDOS,
  });
  return resposta;
}
