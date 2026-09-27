/**
 * **CONTAI-069 — o CNO impresso na nota, lido do texto do PDF.**
 *
 * Módulo puro: sem rede, sem Gemini, sem Groq. Só o texto que o `unpdf` já
 * extraiu localmente (estágio 1 do `texto-pdf.ts`), e já aprovado pela porteira
 * `avaliarTexto` na rota.
 *
 * ## O que ele decide, e o que ele nunca decide
 *
 * Decide: "existe no texto um número **claramente rotulado** como CNO?". Não
 * decide nada sobre a obra — este arquivo não sabe que obra existe. A comparação
 * com o CNO cadastrado é FISCAL e mora em `compararCandidatosCno`
 * (`lib/fiscal/obra.ts`), no CLIENTE.
 *
 * ⚠️ **Por que existe, e contra o que**: o `contador` reprovou **duas vezes** a
 * marcação automática de `cnoNaNota = "desta_obra"` — a 2ª vez já sob igualdade
 * exata de dígitos (`docs/pareceres/2026-09-27-extracao-tributo-e-cno.md`,
 * Pergunta 2 + ADENDO §3). O Mateus, dono do produto, decidiu implementá-la
 * mesmo assim, como sugestão editável, e a divergência está registrada por
 * inteiro em `docs/backlog/85-2026-09-27-cno-automatico-contraria-contador.md`.
 * As salvaguardas deste arquivo não são zelo: são a contenção do risco que o
 * próprio parecer nomeou.
 *
 * ## Nunca dígito solto — sempre rótulo âncora
 *
 * Critério 2 do ticket: o que se procura é **rótulo + número associado**, mesmo
 * padrão estrutural de `extrairLinhasRotuladas` (`retencao-texto.ts`). Buscar
 * "doze dígitos em qualquer lugar do texto" acharia pedaço de chave de acesso,
 * de código de barras e de inscrição municipal — e um deles casaria com o CNO da
 * obra um dia, por sorte. Sem rótulo, lista vazia.
 *
 * ⚠️ **Extrator próprio, e não extensão de `extrairLinhasRotuladas`**: aquele
 * ancora em **valor monetário** (`1.234,56`), que nunca casaria com um CNO. O
 * que se reaproveita é a FORMA (os dois padrões de adjacência medidos no
 * CONTAI-054), não o código.
 *
 * ## Por que exatamente 12 dígitos
 *
 * Critério 3: CNO/matrícula CEI tem 12. 11 é CPF, 14 é CNPJ, 44 é chave de
 * acesso — e os três aparecem em qualquer NFS-e. A âncora de tamanho é o que
 * impede um rótulo genérico ("CEI") de arrastar o CNPJ do prestador para dentro
 * de uma comparação de CNO. Quem conta os dígitos é `cnoNormalizado`
 * (`lib/fiscal/obra.ts`), **a única normalização de CNO do sistema** (critério
 * 4): nenhuma segunda regra de "o que conta como o mesmo CNO" nasce aqui.
 *
 * ## Ambiguidade não vira palpite, e repetição não vira ambiguidade
 *
 * Dois candidatos com dígitos DIFERENTES ficam os dois na lista — quem avisa o
 * Mateus é a tela (critério 9), e ninguém escolhe entre eles. Dois candidatos
 * com os MESMOS dígitos (o leiaute imprime o CNO duas vezes, por exemplo no
 * cabeçalho e no rodapé) colapsam num só, e **vence o que aparece primeiro no
 * texto** — desempate estrutural, nunca por vocabulário de rótulo (critério 10,
 * mesma doutrina de colapso do CONTAI-068).
 *
 * Sem `confianca`, sem fuzzy, sem "melhor palpite".
 */

import { cnoNormalizado, type CandidatoCnoLido } from "@/lib/fiscal/obra";

/**
 * O vocabulário do rótulo — literal, do critério 2. Alternativas mais longas
 * primeiro: "Matrícula CEI" tem de vencer o `CEI` solto, senão o rótulo que
 * aparece na tela do Mateus não é o que está impresso no papel.
 *
 * `CEI` solto entra porque nota antiga ainda imprime só isso (a matrícula CEI é
 * a antecessora do CNO); `\b` nas duas siglas impede casar dentro de palavra.
 */
const RE_ROTULO_CNO =
  /Cadastro\s+Nacional\s+de\s+Obras?|Matr[íi]cula\s+(?:CEI|CNO)|\bCNO\b|\bCEI\b/gi;

/**
 * Um número **maximal** de dígitos e separadores de CNO (`.`, `/`, `-`).
 *
 * ⚠️ **A maximalidade É a proteção do critério 3**, e é o oposto de um detalhe:
 * casar um pedaço de 12 dígitos dentro de uma chave de acesso de 44 é
 * exatamente o falso positivo mais caro que este módulo poderia produzir.
 * Pegando a sequência inteira, a chave de acesso conta 44, o CNPJ 14 e o CPF 11
 * — e nenhum dos três passa pelo filtro de 12.
 *
 * **Espaço fica FORA do conjunto de separadores**, de propósito: CNO não se
 * imprime com espaço no meio, e aceitá-lo grudaria o número seguinte da linha
 * ("12.345.67890/26 - 1º Ofício") no candidato, derrubando por tamanho um
 * candidato legítimo.
 */
const RE_NUMERO_MAXIMAL = /\d[\d./-]*\d|\d/g;

/** Quantos dígitos um candidato tem de ter para ser aceito. */
const DIGITOS_ESPERADOS = 12;

/** O número, só quando os dígitos dele são exatamente 12. */
function candidatoAceito(bruto: string): string | null {
  const digitos = cnoNormalizado(bruto);
  return digitos !== null && digitos.length === DIGITOS_ESPERADOS ? bruto : null;
}

/**
 * A linha é só um número — nada além dele, tirando pontuação de alinhamento. É a
 * metade de baixo de uma célula de tabela (padrão (b) abaixo). `null` quando a
 * linha não é isso: nenhum número, mais de um, ou sobra texto que seria rótulo.
 *
 * Mesma ideia do `valorSozinhoNaLinha` de `retencao-texto.ts`, com a âncora de
 * dinheiro trocada pela de CNO.
 */
function numeroSozinhoNaLinha(linha: string | undefined): string | null {
  if (linha === undefined) return null;

  const achados = [...linha.matchAll(RE_NUMERO_MAXIMAL)];
  if (achados.length !== 1) return null;

  const resto = linha.replace(achados[0][0], " ");
  if (!/^[\s.:;=,\-–—_·•|/\\]*$/u.test(resto)) return null;

  return achados[0][0];
}

/**
 * Os candidatos de CNO do texto, na ordem em que aparecem, já colapsados por
 * dígitos idênticos. `[]` é "não achei" — e nunca "esta nota não traz CNO", que
 * é resposta do Mateus e não conclusão de parser.
 *
 * Dois padrões de adjacência, os mesmos dois medidos com o `unpdf` no
 * CONTAI-054:
 *
 * **(a) Mesma linha**: `"CNO: 12.345.67890/26"`. O número é o PRIMEIRO
 * encontrado depois do rótulo e antes do rótulo seguinte da mesma linha —
 * "imediatamente associado". Se o primeiro número depois do rótulo não tiver 12
 * dígitos, o candidato morre ali: continuar procurando na linha acharia um
 * número qualquer longe do rótulo, que é a busca sem âncora que o critério 2
 * proíbe.
 *
 * **(b) Rótulo numa linha, número na seguinte**: o PDF.js emite um item de texto
 * por célula de tabela, então a célula "CNO / 12.345.67890/26" chega como duas
 * linhas consecutivas. Só vale quando a linha do rótulo não tem número nenhum
 * depois dele e a seguinte é só o número.
 *
 * ⚠️ **Divergência consciente de `extrairLinhasRotuladas`**: lá o padrão (b)
 * exige que a linha seguinte à do valor **não** seja outro valor solto (guarda
 * contra a tabela que despeja todos os rótulos e só depois todos os valores).
 * Aqui essa guarda não entra, e a razão é o filtro de 12 dígitos: na tabela
 * despejada, a linha seguinte ao rótulo "CNO" seria outro RÓTULO (texto), e o
 * padrão (b) já a recusa. O que a guarda faria de fato seria calar um candidato
 * legítimo por causa de um número solto qualquer logo abaixo dele — e silêncio
 * por acidente é o que o critério 9 existe para evitar.
 */
export function extrairCandidatosCno(texto: string): CandidatoCnoLido[] {
  const achados: CandidatoCnoLido[] = [];
  const brutas = texto.split(/\r?\n/).filter((linha) => linha.trim() !== "");

  for (let i = 0; i < brutas.length; i += 1) {
    const linha = brutas[i];
    const rotulos = [...linha.matchAll(RE_ROTULO_CNO)];

    for (let r = 0; r < rotulos.length; r += 1) {
      const rotulo = rotulos[r];
      const inicioDoTrecho = rotulo.index + rotulo[0].length;
      // O trecho que "pertence" a este rótulo termina onde começa o próximo:
      // dois rótulos na mesma linha não podem disputar o mesmo número.
      const fimDoTrecho = rotulos[r + 1]?.index ?? linha.length;
      const trecho = linha.slice(inicioDoTrecho, fimDoTrecho);

      const naMesmaLinha = trecho.match(RE_NUMERO_MAXIMAL)?.[0] ?? null;
      if (naMesmaLinha !== null) {
        // (a) — o primeiro número depois do rótulo, e só ele.
        const aceito = candidatoAceito(naMesmaLinha);
        if (aceito !== null) {
          achados.push({ rotuloLiteral: rotulo[0], numeroBruto: aceito });
        }
        continue;
      }

      // (b) — só o ÚLTIMO rótulo da linha pode reclamar a linha seguinte.
      if (r !== rotulos.length - 1) continue;
      const naLinhaSeguinte = numeroSozinhoNaLinha(brutas[i + 1]);
      if (naLinhaSeguinte === null) continue;
      const aceito = candidatoAceito(naLinhaSeguinte);
      if (aceito !== null) {
        achados.push({ rotuloLiteral: rotulo[0], numeroBruto: aceito });
      }
    }
  }

  // Colapso por DÍGITOS (critério 10): o mesmo número impresso duas vezes é
  // repetição de leiaute, não ambiguidade. Vence a primeira aparição — critério
  // estrutural, nunca preferência por um vocabulário de rótulo.
  const vistos = new Set<string>();
  return achados.filter((candidato) => {
    const digitos = cnoNormalizado(candidato.numeroBruto) as string;
    if (vistos.has(digitos)) return false;
    vistos.add(digitos);
    return true;
  });
}
