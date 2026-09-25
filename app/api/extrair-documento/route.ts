/**
 * US-008, Fase 2 — extração automática de documento via Gemini.
 *
 * Coberto pelo `proxy.ts` como qualquer outra rota do app: sem sessão válida,
 * a requisição nem chega aqui (redireciona para /entrar antes). Não é
 * autorização fina — é o mesmo portão de sempre, e é suficiente: o único
 * efeito desta rota é gastar cota do Gemini, não ler nem gravar dado de obra
 * nenhuma (quem grava é o formulário, depois que o Mateus confirma os campos).
 *
 * Só lê o PDF e devolve sugestão de preenchimento — nunca grava nada no
 * banco. O registro em si continua exigindo o "Salvar" manual, com as mesmas
 * validações fiscais de sempre.
 */

import { NextResponse } from "next/server";

import { ExtracaoIndisponivelError } from "@/lib/extracao/erros";
import { extrairDocumento } from "@/lib/extracao/provider";

// Payload de requisição de função no Vercel (Hobby) tem teto de 4,5 MB; base64
// soma ~33% ao tamanho do arquivo. 3 MB de PDF vira ~4 MB de JSON — folga
// segura sem crescer o limite pela metade.
const TAMANHO_MAXIMO_BYTES = 3 * 1024 * 1024;

/**
 * CONTAI-052, fecha a **dívida D70** junto com os `AbortSignal.timeout()` dos
 * provedores. Antes disto a rota não declarava teto nenhum e herdava o default
 * do plano (10s na Vercel Hobby) — abaixo de uma única tentativa do Gemini com
 * retry, o que cortava a função no meio da cadeia.
 *
 * 60s cobre o caminho normal com folga (texto local + Groq sai em ~2s; Gemini
 * com um retry, em ~25s). O pior caso absoluto — as duas cadeias esgotando
 * retry, ~98s — passa disto e é aceito no ticket: exige os dois provedores
 * fora do ar ao mesmo tempo, e a UI já trata falha de rota como "preencha à
 * mão".
 *
 * Sem `export const runtime`: `nodejs` já é o default e o Edge Runtime está
 * deprecado no Next 16 (a doc manda remover o export). O `unpdf` exige Node.
 */
export const maxDuration = 60;

export async function POST(request: Request) {
  let arquivo: File | null;
  try {
    const form = await request.formData();
    const campo = form.get("arquivo");
    arquivo = campo instanceof File ? campo : null;
  } catch {
    return NextResponse.json(
      { erro: "Requisição inválida — esperado multipart/form-data." },
      { status: 400 },
    );
  }

  if (!arquivo) {
    return NextResponse.json({ erro: "Nenhum arquivo enviado." }, { status: 400 });
  }
  if (arquivo.type !== "application/pdf") {
    return NextResponse.json(
      { erro: "Extração automática só funciona com PDF por enquanto." },
      { status: 400 },
    );
  }
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    return NextResponse.json(
      {
        erro: `PDF maior que ${TAMANHO_MAXIMO_BYTES / (1024 * 1024)} MB — preencha à mão desta vez.`,
      },
      { status: 413 },
    );
  }

  const bytes = Buffer.from(await arquivo.arrayBuffer());
  const base64 = bytes.toString("base64");

  try {
    const { dados, origem } = await extrairDocumento(base64, arquivo.type);
    // `origem` fica só no log: saber se o documento saiu pelo texto ou pela
    // visão é o que permite medir se o estágio novo está de fato tirando carga
    // da cota do Gemini. Não vai na resposta — a UI não tem nem deve ter campo
    // para isso (CONTAI-052, critério 5: zero mudança de UX).
    console.info(`[extrair-documento] extraído via ${origem}.`);
    return NextResponse.json(dados);
  } catch (erro) {
    // Log da Vercel é a única telemetria de produção que temos aqui: sem isto,
    // "erro frequente no parse da nota" chega sem causa nenhuma.
    if (erro instanceof ExtracaoIndisponivelError) {
      // `tentativas` separa blip (1 chamada, 503 que sumiu no retry) de
      // indisponibilidade real (3 chamadas, mesmo erro) no log da Vercel.
      console.error(
        `[extrair-documento] extração indisponível (tentativas: ${erro.tentativas}):`,
        erro.message,
      );
      return NextResponse.json({ erro: erro.message }, { status: 502 });
    }
    console.error(
      "[extrair-documento] falha inesperada:",
      erro instanceof Error ? erro.message : String(erro),
    );
    return NextResponse.json(
      { erro: "Falha inesperada na extração." },
      { status: 500 },
    );
  }
}
