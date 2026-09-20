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

import { extrairDocumento } from "@/lib/extracao/provider";
import { ExtracaoIndisponivelError } from "@/lib/extracao/gemini";

// Payload de requisição de função no Vercel (Hobby) tem teto de 4,5 MB; base64
// soma ~33% ao tamanho do arquivo. 3 MB de PDF vira ~4 MB de JSON — folga
// segura sem crescer o limite pela metade.
const TAMANHO_MAXIMO_BYTES = 3 * 1024 * 1024;

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
    const extraido = await extrairDocumento(base64, arquivo.type);
    return NextResponse.json(extraido);
  } catch (erro) {
    if (erro instanceof ExtracaoIndisponivelError) {
      return NextResponse.json({ erro: erro.message }, { status: 502 });
    }
    return NextResponse.json(
      { erro: "Falha inesperada na extração." },
      { status: 500 },
    );
  }
}
