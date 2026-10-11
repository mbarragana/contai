/**
 * **CONTAI-092 — o estado do card "Integrações" (critério 16).**
 *
 * ⚠️ **Por que é rota, e não leitura pelo PostgREST como o resto do app**: o
 * estado 1 ("Não configurado") depende das três variáveis de ambiente, que são
 * **server-only** (critério 15) e por definição invisíveis ao browser. Partir o
 * card entre "o que vem do banco" e "o que vem de uma rota só para a env" daria
 * duas idas de rede e duas fontes para um card de quatro estados — e a chance de
 * elas discordarem (banco diz conectado, env diz não configurado) é justamente o
 * caso que o critério 15 manda resolver a favor de "não configurado".
 *
 * ⚠️ **`refresh_token` não aparece na resposta**: `lerDadosDaIntegracao` seleciona
 * colunas nomeadas, nunca `*`.
 */

import { NextResponse } from "next/server";

import { lerDadosDaIntegracao } from "@/lib/agenda/sincronizar";
import { usuarioDaRequisicao } from "@/lib/supabase-servidor";

export async function GET() {
  const autenticado = await usuarioDaRequisicao();
  if (!autenticado) {
    return NextResponse.json({ erro: "Sem sessão." }, { status: 401 });
  }

  try {
    const dados = await lerDadosDaIntegracao(autenticado.supabase);
    // Sem cache: o card tem de mudar para o estado 4 na carga SEGUINTE depois de
    // uma revogação detectada (critério 6), e uma resposta cacheada pela CDN
    // manteria "conectado" na tela enquanto nenhum lembrete sai.
    return NextResponse.json(dados, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (erro) {
    console.warn(
      `[agenda] estado falhou: ${erro instanceof Error ? erro.message : String(erro)}`,
    );
    return NextResponse.json(
      { erro: "Não foi possível ler o estado da integração." },
      { status: 500 },
    );
  }
}
