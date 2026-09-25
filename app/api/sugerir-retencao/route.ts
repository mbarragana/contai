/**
 * **CONTAI-054 — sugestão determinística da linha de retenção.**
 *
 * Rota SEPARADA da `/api/extrair-documento` de propósito (Viabilidade/CTO): a
 * extração de documento roda ao ANEXAR o arquivo, antes de o gate de retenção
 * existir; esta roda DEPOIS, quando o Mateus responde "destacada". Juntar as
 * duas misturaria dois modos de falha diferentes — lá, cota de provedor de IA
 * fora do ar; aqui, texto do PDF que não presta.
 *
 * Nada de IA: só `extrairTextoDoPdf → avaliarTexto → sugerirLinhaRetencao`,
 * tudo local. Por isso **não** há `maxDuration = 60` (o caminho é de
 * milissegundos, o default do plano sobra) e **não** há fallback de visão — PDF
 * sem camada de texto simplesmente não gera sugestão, e o campo continua
 * manual, como hoje.
 *
 * Coberta pelo `proxy.ts` como toda rota do app: sem sessão, a requisição não
 * chega aqui. Não lê nem grava dado de obra nenhuma — só olha o PDF que veio no
 * corpo e devolve uma sugestão a confirmar. Quem afirma o registro continua
 * sendo o "Salvar" manual.
 */

import { NextResponse } from "next/server";

import {
  sugerirLinhaRetencao,
  type SugestaoLinhaRetencao,
} from "@/lib/extracao/retencao-texto";
import { avaliarTexto, extrairTextoDoPdf } from "@/lib/extracao/texto-pdf";
import type { RespostaRetencaoNaNota } from "@/lib/types";

/** Mesmo teto da rota de extração: payload de função no Vercel Hobby. */
const TAMANHO_MAXIMO_BYTES = 3 * 1024 * 1024;

type Resposta = { sugestao: SugestaoLinhaRetencao | null };

const SEM_SUGESTAO: Resposta = { sugestao: null };

/**
 * O gate chega como string do formulário. Só `"destacada"` habilita a leitura;
 * qualquer outra coisa (inclusive ausente, vazio ou valor desconhecido) é
 * tratada como "não é destacada" — a rota nunca decide o gate, em nenhuma
 * direção (critério 1 / Gate Fiscal 1).
 */
function lerGate(valor: FormDataEntryValue | null): RespostaRetencaoNaNota | null {
  return valor === "destacada" ? "destacada" : null;
}

export async function POST(request: Request) {
  let arquivo: File | null;
  let gate: RespostaRetencaoNaNota | null;
  try {
    const form = await request.formData();
    const campo = form.get("arquivo");
    arquivo = campo instanceof File ? campo : null;
    gate = lerGate(form.get("retencaoNaNota"));
  } catch {
    return NextResponse.json(
      { erro: "Requisição inválida — esperado multipart/form-data." },
      { status: 400 },
    );
  }

  // Gate antes de tudo, e antes de ler um byte do PDF: com `null` ou
  // `"nenhuma"` não existe caminho em que o texto influencie a resposta.
  if (gate !== "destacada") {
    return NextResponse.json(SEM_SUGESTAO);
  }

  if (!arquivo) {
    return NextResponse.json({ erro: "Nenhum arquivo enviado." }, { status: 400 });
  }
  // Critério 5: fonte é só texto embutido de PDF. Foto/scan não aciona a rota —
  // e quando acionar por acidente, para aqui.
  if (arquivo.type !== "application/pdf") {
    return NextResponse.json(SEM_SUGESTAO);
  }
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    return NextResponse.json(SEM_SUGESTAO);
  }

  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const lido = await extrairTextoDoPdf(bytes);
  if (lido === null) {
    return NextResponse.json(SEM_SUGESTAO);
  }

  // Mesma porteira do estágio 1 da extração: texto curto, poluído por fonte sem
  // `ToUnicode` ou sem âncora de documento fiscal não vira leitura de valor. Um
  // trio aritmeticamente coerente lido de lixo é justamente o falso positivo
  // mais caro que esta rota poderia produzir.
  const avaliacao = avaliarTexto(lido.texto);
  if (!avaliacao.suficiente) {
    console.info(
      `[sugerir-retencao] texto insuficiente (${avaliacao.motivo}) — sem sugestão.`,
    );
    return NextResponse.json(SEM_SUGESTAO);
  }

  const sugestao = sugerirLinhaRetencao(lido.texto, gate);
  return NextResponse.json({ sugestao } satisfies Resposta);
}
