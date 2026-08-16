import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { COOKIE_SESSAO, PARAM_DESTINO, ROTA_ENTRAR } from "@/lib/auth";

/**
 * Proxy do Next 16 (o antigo `middleware.ts`; ver
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
 *
 * Ele existe por UM motivo, e o motivo é a sessão sobreviver no iPhone.
 *
 * O ITP do Safari apaga armazenamento gravável por script — localStorage E
 * cookie escrito por `document.cookie` — depois de ~7 dias sem interação com
 * o site. Trocar localStorage por cookie do browser não resolveria nada. O que
 * escapa do corte é cookie regravado pelo SERVIDOR no cabeçalho `Set-Cookie`,
 * e é isso que acontece aqui: a cada navegação o `getUser()` valida (e, se
 * preciso, renova) a sessão, e a resposta sai com o cookie novo.
 *
 * De carona, o guard de rota fica no servidor: rota pedida sem sessão vai para
 * /entrar já com `?destino=`, sem piscar a tela protegida antes (critério 4).
 * A RLS continua sendo a guarda de verdade dos dados — isto é UX e frescor de
 * cookie, não autorização.
 */

/** Rotas que não exigem sessão. */
const PUBLICAS = new Set<string>([ROTA_ENTRAR]);

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // Sem configuração não há o que renovar nem o que proteger: o app cai no
  // ConfiguracaoAusenteError, que diz o que fazer. Barrar aqui só esconderia.
  if (!url || !key) return NextResponse.next({ request });

  let resposta = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookieOptions: { name: COOKIE_SESSAO },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookies, headers) {
        for (const { name, value } of cookies) {
          request.cookies.set(name, value);
        }
        resposta = NextResponse.next({ request });
        for (const { name, value, options } of cookies) {
          resposta.cookies.set(name, value, options);
        }
        // A biblioteca manda os cabeçalhos de no-store junto: resposta com
        // Set-Cookie de sessão não pode ser cacheada por CDN, senão a sessão
        // de um vira a sessão de outro.
        for (const [chave, valor] of Object.entries(headers)) {
          resposta.headers.set(chave, valor);
        }
      },
    },
  });

  // `getUser()` bate no GoTrue: valida o access token e renova quando vencido.
  // É a chamada que produz o `Set-Cookie` do servidor.
  const { data, error } = await supabase.auth.getUser();

  const caminho = request.nextUrl.pathname;
  if (PUBLICAS.has(caminho)) return resposta;
  if (data.user) return resposta;

  // Servidor fora do ar NÃO é o mesmo que sessão ausente (critério 5): mandar
  // para o login aqui transformaria "banco fora" em "entre de novo", e entrar
  // de novo não resolve banco fora. Deixa passar e o app mostra o erro certo.
  const nome = (error as { name?: string } | null)?.name;
  const status = (error as { status?: number } | null)?.status;
  if (nome === "AuthRetryableFetchError" || (status !== undefined && status >= 500)) {
    return resposta;
  }

  const destino = new URL(ROTA_ENTRAR, request.url);
  const pedido = `${caminho}${request.nextUrl.search}`;
  if (pedido !== "/") destino.searchParams.set(PARAM_DESTINO, pedido);

  const redirecionamento = NextResponse.redirect(destino);
  // Os cookies renovados vão junto: perder a renovação num redirect faria a
  // próxima navegação renovar de novo, e sob o ITP isso é sessão perdida.
  for (const cookie of resposta.cookies.getAll()) {
    redirecionamento.cookies.set(cookie);
  }
  return redirecionamento;
}

export const config = {
  // Tudo que não é estático nem ícone. Sem isto o proxy roda também em
  // _next/static e cada CSS viraria uma chamada ao GoTrue.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest).*)"],
};
