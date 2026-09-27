/**
 * **CONTAI-054 — sugestão determinística da linha de retenção.**
 *
 * Rota SEPARADA da `/api/extrair-documento` de propósito (Viabilidade/CTO):
 * modos de falha diferentes — lá, cota de provedor de IA fora do ar; aqui,
 * texto do PDF que não presta. Juntar as duas misturaria os dois.
 *
 * ⚠️ **MUDOU NO CONTAI-062 — o gate saiu do corpo da requisição.** Até aqui esta
 * rota recebia `retencaoNaNota` e devolvia `{ sugestao: null }` sem ler um byte
 * quando ele não fosse `"destacada"`, "porque a rota nunca decide o gate". O
 * **ADENDO 5** de `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md`
 * (§0, §1) desfaz essa leitura: o gate é pergunta de EXISTÊNCIA de um texto
 * impresso, aritmeticamente conferível, e não de classificação — logo pode ser
 * sugerido. Então a rota lê o PDF assim que ele chega, e o cliente deriva o gate
 * de `sugestao !== null`.
 *
 * ⚠️ **É esse formato de resposta que garante a salvaguarda 4 do ADENDO 5 §3
 * estruturalmente**: o único canal que a rota tem para dizer "há retenção nesta
 * nota" é a própria linha (`rotuloLiteral` + `valorCentavos`). Não existe campo
 * aqui que sugira o gate sem trazer a linha que o motivou — não é disciplina de
 * quem chama, é a forma do tipo. E `sugestao: null` **não** é
 * `"nao_destacada"`: é "não achei padrão", e quem chama não tem como confundir
 * os dois (salvaguardas 2 e 3).
 *
 * ⚠️ **MUDOU NO CONTAI-069 — a rota lê DUAS coisas do mesmo PDF.** Além da linha
 * de retenção, ela devolve os números rotulados como CNO (`extrairCandidatosCno`).
 * Mesma requisição, mesmo PDF, mesmo alvo (`nf_servico`, de `exigeRetencao` e
 * `exigeCnoReferenciado`, que nunca divergem) — uma segunda rota significaria um
 * segundo upload do mesmo arquivo e uma segunda cadeia de invalidação dele. O
 * nome da rota ficou estreito para o que ela faz; renomear é opcional e não é
 * critério do ticket.
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

import { extrairCandidatosCno } from "@/lib/extracao/cno-texto";
import {
  sugerirLinhaRetencao,
  type SugestaoLinhaRetencao,
} from "@/lib/extracao/retencao-texto";
import { avaliarTexto, extrairTextoDoPdf } from "@/lib/extracao/texto-pdf";
import type { CandidatoCnoLido } from "@/lib/fiscal/obra";

/** Mesmo teto da rota de extração: payload de função no Vercel Hobby. */
const TAMANHO_MAXIMO_BYTES = 3 * 1024 * 1024;

type Resposta = {
  sugestao: SugestaoLinhaRetencao | null;
  /**
   * **NOVO — CONTAI-069.** Os números rotulados como CNO que o parser achou no
   * papel, crus, na ordem do texto. `[]` é "não achei nenhum".
   *
   * ⚠️ **A rota NÃO compara, e isso é decisão de arquitetura, não preguiça**
   * (Viabilidade do ticket): ela não recebe dado de obra nenhum hoje e não passa
   * a receber. Quem compara com o `obra.cno` é o CLIENTE, que tem sempre a obra
   * CORRENTE em mão — é o que resolve o pre-mortem 3 (obra trocada com a leitura
   * em voo) sem um segundo fetch. O que sai daqui é leitura de papel, nunca
   * veredito.
   */
  cno: CandidatoCnoLido[];
};

const SEM_SUGESTAO: Resposta = { sugestao: null, cno: [] };

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
  //
  // ⚠️ **CONTAI-069 — a leitura do CNO passa pela MESMA porteira**, e de
  // propósito: um número de 12 dígitos lido de texto poluído, rotulado por um
  // "CNO" que a fonte sem `ToUnicode` inventou, viraria sugestão de gate fiscal.
  const avaliacao = avaliarTexto(lido.texto);
  if (!avaliacao.suficiente) {
    console.info(
      `[sugerir-retencao] texto insuficiente (${avaliacao.motivo}) — sem sugestão.`,
    );
    return NextResponse.json(SEM_SUGESTAO);
  }

  const sugestao = sugerirLinhaRetencao(lido.texto);
  const cno = extrairCandidatosCno(lido.texto);
  return NextResponse.json({ sugestao, cno } satisfies Resposta);
}
