import type { APIRequestContext } from "@playwright/test";

/**
 * O código de 6 dígitos é lido do e-mail DE VERDADE.
 *
 * O Mailpit é o servidor SMTP do stack local (`[inbucket]` no
 * supabase/config.toml, porta 54334): o GoTrue entrega nele o e-mail que
 * entregaria ao Gmail do Mateus, renderizado pelo template real
 * (supabase/templates/magic_link.html). Nada aqui falsifica backend — se o
 * template parar de expor `{{ .Token }}`, estes testes ficam vermelhos, que é
 * exatamente o que se quer.
 */

export const URL_MAILPIT = "http://127.0.0.1:54334";

/** Caixa vazia antes de cada pedido: senão se lê o código do teste anterior. */
export async function limparCaixaDeEntrada(request: APIRequestContext) {
  const resposta = await request.delete(`${URL_MAILPIT}/api/v1/messages`);
  if (!resposta.ok()) {
    throw new Error(
      `Mailpit não respondeu em ${URL_MAILPIT}. O stack local está de pé? ` +
        "`npm run db:start`",
    );
  }
}

/**
 * O código vem do ASSUNTO ("442944 é o seu código de acesso — contai"), que é
 * onde o config.toml o coloca. Devolve "" enquanto o e-mail não chegou, para
 * o chamador poder usar `expect.poll`.
 */
export async function codigoNaCaixa(
  request: APIRequestContext,
  email: string,
): Promise<string> {
  const resposta = await request.get(
    `${URL_MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
  );
  if (!resposta.ok()) return "";
  const corpo = (await resposta.json()) as {
    messages?: { Subject: string }[];
  };
  const mensagem = (corpo.messages ?? []).find((m) => /^\d{6}\b/.test(m.Subject));
  return mensagem ? mensagem.Subject.slice(0, 6) : "";
}
