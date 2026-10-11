/**
 * **CONTAI-092, critério 17 — a volta do consentimento.**
 *
 * Valida o `state`, troca o `code` por tokens **no servidor** (com o
 * `client_secret`) e grava `integracao_google` pelo client autenticado pelo
 * cookie de sessão. Sempre termina redirecionando para `/conta` — o Mateus veio
 * de uma navegação de página inteira e tem de voltar para uma tela, nunca para
 * um JSON.
 *
 * ⚠️ **Cancelamento/negação no Google não grava NADA** (critério 17): volta para
 * `/conta?google=negado`, que é o estado 2 do card com um aviso de um
 * carregamento só. "Nada foi alterado" é literal.
 */

import { NextResponse, type NextRequest } from "next/server";

import { configDoGoogle } from "@/lib/agenda/config";
import {
  COOKIE_STATE,
  PARAM_RESULTADO,
  stateConfere,
  type ResultadoOAuth,
} from "@/lib/agenda/oauth";
import {
  descobrirEmailDaConta,
  trocarCodigoPorToken,
} from "@/lib/agenda/google";
import { usuarioDaRequisicao } from "@/lib/supabase-servidor";

const ROTA_CONTA = "/conta";

/** Volta para `/conta` consumindo o cookie de `state` — ele é de uma vez só. */
function voltar(request: NextRequest, resultado?: ResultadoOAuth) {
  const destino = new URL(ROTA_CONTA, request.url);
  if (resultado) destino.searchParams.set(PARAM_RESULTADO, resultado);
  const resposta = NextResponse.redirect(destino);
  resposta.cookies.delete(COOKIE_STATE);
  return resposta;
}

export async function GET(request: NextRequest) {
  const autenticado = await usuarioDaRequisicao();
  if (!autenticado) {
    return NextResponse.json({ erro: "Sem sessão." }, { status: 401 });
  }

  const config = configDoGoogle();
  if (!config) {
    return NextResponse.json(
      { erro: "Integração com o Google Agenda não está configurada." },
      { status: 503 },
    );
  }

  const parametros = request.nextUrl.searchParams;

  // O Google manda `error=access_denied` quando o Mateus cancela ou nega.
  if (parametros.get("error")) {
    return voltar(request, "negado");
  }

  // ⚠️ `state` ausente ou diferente do cookie é RECUSA, nunca "deixa passar":
  // sem ele não há prova de que este navegador começou o fluxo, e concluir
  // mesmo assim é gravar credencial a partir de uma volta que alguém montou.
  const doCookie = request.cookies.get(COOKIE_STATE)?.value;
  if (!stateConfere(doCookie, parametros.get("state"))) {
    console.warn("[agenda] callback com state que não confere — descartado.");
    return voltar(request, "falhou");
  }

  const code = parametros.get("code");
  if (!code) return voltar(request, "falhou");

  try {
    const concedida = await trocarCodigoPorToken(config, code);
    // Melhor esforço, e `null` é aceitável: o escopo `calendar.events` não dá
    // acesso ao perfil (ver `descobrirEmailDaConta`). Falhar aqui não pode
    // impedir a autorização de ser gravada.
    const emailConta = await descobrirEmailDaConta(concedida.accessToken);

    const { error } = await autenticado.supabase
      .from("integracao_google")
      .upsert(
        {
          user_id: autenticado.userId,
          refresh_token: concedida.refreshToken,
          email_conta: emailConta,
          escopo: concedida.escopo,
          concedido_em: new Date().toISOString(),
          // Reautorizar LIMPA a revogação — é exatamente o que o botão
          // "Conectar de novo" do estado 4 existe para fazer. O check
          // `integracao_google_revogacao_par_completo` exige o par: os dois
          // juntos, sempre.
          revogado_em: null,
          motivo_revogacao: null,
        },
        { onConflict: "user_id" },
      );
    if (error) throw error;
  } catch (erro) {
    // ⚠️ Nenhuma mensagem do Google chega à tela: o texto que o Mateus lê é
    // fixo (Gate Fiscal 7b — falha de integração nunca é apresentada como fato
    // sobre o compromisso). O detalhe fica no log da Vercel.
    console.warn(
      `[agenda] troca do código falhou: ${erro instanceof Error ? erro.message : String(erro)}`,
    );
    return voltar(request, "falhou");
  }

  // ⚠️ Sem sincronização automática aqui, de propósito: a autorização acabou de
  // nascer e o caminho que preenche o calendário é a reconciliação do critério
  // 11 (o botão "Sincronizar agora", que o card já mostra, e a abertura da
  // Home). Gravar N eventos dentro de um redirect faria o Mateus esperar na
  // tela branca da volta do Google, sem saber o que está acontecendo.
  return voltar(request);
}
