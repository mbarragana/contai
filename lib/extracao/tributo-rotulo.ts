/**
 * **CONTAI-070 — a categoria do tributo, classificada a partir do rótulo lido.**
 *
 * Módulo puro: sem rede, sem Gemini, sem Groq. Entra o CONJUNTO de rótulos que já
 * colapsaram na mesma linha de retenção (`rotulosEmpatados` de
 * `sugerirLinhaRetencao`), sai **uma** das 6 categorias de `tributo_retido` ou
 * `null`.
 *
 * ## ⚠️ Por que este arquivo existe, e contra o que
 *
 * O `contador` reprovou **sem exceção** sugerir `composicao`/`tributo` a partir do
 * rótulo (`docs/pareceres/2026-09-27-extracao-tributo-e-cno.md`, Pergunta 1,
 * citando o critério 14 do `CONTAI-038`): mapear língua natural para 1 de 6
 * categorias legais é interpretar texto livre contra taxonomia jurídica —
 * categoricamente diferente de ler um fato aritmético (o teste que aprovou a
 * sugestão de rótulo/valor no ADENDO 5 do parecer de 2026-09-18). O **Mateus, dono
 * do produto, decidiu implementar mesmo assim**, estendendo ao tributo a decisão
 * que já tinha tomado para o CNO — registrado por inteiro no ADENDO de
 * `docs/backlog/85-2026-09-27-cno-automatico-contraria-contador.md`.
 *
 * **A salvaguarda que sobra da reprovação não é zelo — é o critério 3 do ticket**,
 * e é ela que contém exatamente o risco que o parecer nomeou: o corpus real do
 * projeto já produziu o rótulo "Total das Retenções (ISSQN / Federais)", que uma
 * regra ingênua de palavra-chave classificaria como ISS puro — calando, em
 * silêncio, a pendência de recolhimento de uma retenção parcialmente federal.
 *
 * ## As três passagens, nesta ordem
 *
 * 1. **Marcador de combinação/agregação** em QUALQUER rótulo do conjunto → `null`,
 *    antes de olhar categoria nenhuma. "Mais de um tributo aqui dentro" vence
 *    qualquer sigla que apareça ao lado.
 * 2. **Exatamente UMA categoria**, e a MESMA em todos os rótulos do conjunto.
 *    Zero categorias, duas categorias, ou categorias divergentes entre rótulos
 *    empatados → `null`.
 * 3. O que sobra é a categoria. Nunca "a mais provável", nunca por aproximação.
 *
 * Sem `confianca`, sem fuzzy, sem melhor palpite — mesma doutrina "ambíguo vira
 * silêncio" do resto do parser de retenção (`retencao-texto.ts`).
 *
 * ## O que este módulo NUNCA decide
 *
 * `eDescontoEfetivo` e `quemRecolhe` — impossíveis de ler de um papel, ponto
 * unânime entre o `contador` e o Mateus (ADENDO 5 §4 do parecer de 2026-09-18).
 * O tipo de retorno não tem como expressá-los, e é o compilador que garante:
 * `TributoRetido | null`, e nada mais. `natureza_da_retencao` e `notaNoCpf`
 * seguem igualmente proibidos.
 */

import type { TributoRetido } from "@/lib/types";

/**
 * **Vocabulário genérico de "mais de um tributo", nunca jargão de prefeitura** —
 * mesma doutrina do `RE_NAO_TRIBUTARIO` do `CONTAI-068` (critério 3(a)): a lista
 * descreve AGREGAÇÃO, não emissor. Acrescentar termo específico de município ou de
 * sistema emissor aqui passa pelo `contador` antes (pre-mortem 1 do ticket).
 *
 * - `reten[cç][oõ]es` / `tributos` / `contribui[cç][oõ]es`: **o plural é o sinal**.
 *   "Retenções", "Tributos Federais", "Contribuições Sociais Retidas" são somas de
 *   linhas, e a nota não abriu quais. O singular ("Retenção de ISS") não é
 *   marcador — ali há um tributo nomeado, e é o caso que este ticket serve.
 *   ⚠️ **A classe `[cç]` não é enfeite**: o Viabilidade do ticket escreveu
 *   `retenc[oõ]es`, que não casa com "Retenções" — a forma que a nota real imprime
 *   e a que o próprio critério 12 cita. Sem o `ç` o contraexemplo do parecer
 *   passaria batido em qualquer nota com acentuação normal.
 * - `federa`: "Federais"/"Federal" nomeia um GRUPO de tributos (IRRF, PIS, COFINS,
 *   CSLL, INSS), nunca um deles.
 * - `csrf`: a sigla do grupo 4,65% (PIS+COFINS+CSLL retidos juntos), citada
 *   nominalmente no critério 4 do ticket.
 * - `\+` e `/`: combinação escrita com pontuação ("ISS + INSS", "PIS/COFINS").
 */
const RE_COMBINACAO =
  /reten[cç][oõ]es|tributos|contribui[cç][oõ]es|federa|\bcsrf\b|\+|\//i;

/**
 * Uma palavra-chave por categoria, **com fronteira de palavra (`\b`)** — e a
 * fronteira é a mitigação do pre-mortem 2, nomeada como risco conhecido desde o
 * parecer de 2026-09-18 ("Confundir INSS com ISS"). As duas siglas compartilham
 * três letras, e substring solta transformaria a classificação de ISS na de INSS
 * numa nota qualquer.
 *
 * As variações ficam DENTRO da mesma categoria porque são a mesma exação com
 * outro nome de campo: `ISSQN`/`ISSRF` é ISS municipal, `IRRF`/`IRPJ` é imposto de
 * renda retido. Ampliar esta lista está fora de escopo (calibração fina só com
 * falso negativo medido na prática) e exige o `contador`.
 */
const CATEGORIAS: readonly { categoria: TributoRetido; palavra: RegExp }[] = [
  { categoria: "iss", palavra: /\bISS(QN|RF)?\b/i },
  { categoria: "inss", palavra: /\bINSS\b/i },
  { categoria: "irrf", palavra: /\bIR(RF|PJ)?\b/i },
  { categoria: "pis", palavra: /\bPIS\b/i },
  { categoria: "cofins", palavra: /\bCOFINS\b/i },
  { categoria: "csll", palavra: /\bCSLL\b/i },
];

/**
 * A categoria que TODOS os rótulos do conjunto nomeiam, de forma inequívoca e
 * exclusiva — ou `null`.
 *
 * `null` é o resultado de quatro situações diferentes, e de propósito elas
 * colapsam numa só (critério 6: silêncio simples, sem aviso): conjunto vazio,
 * rótulo com marcador de combinação, rótulo sem categoria nenhuma, e rótulos
 * empatados apontando para categorias diferentes. Nenhuma delas autoriza um
 * palpite, e a tela não tem o que explicar em nenhuma — os dois campos ficam
 * vazios, como no formulário de sempre.
 *
 * @param rotulos os rótulos que colapsaram na MESMA linha de retenção
 *   (`rotulosEmpatados`), na ordem de aparição no texto — nunca só o primeiro
 *   (critério 2): se "Valor ISS" e "ISSRF" imprimem o mesmo número, os DOIS têm de
 *   concordar antes de virar sugestão.
 */
export function sugerirTributoDoRotulo(
  rotulos: readonly string[],
): TributoRetido | null {
  // Conjunto vazio não é "não achei categoria": é "não houve linha". Os dois
  // levam ao mesmo silêncio.
  if (rotulos.length === 0) return null;

  let unica: TributoRetido | null = null;

  for (const rotulo of rotulos) {
    // (1) Agregação vence sigla: "Total das Retenções (ISSQN / Federais)" para
    // aqui, sem nunca chegar a contar categorias.
    if (RE_COMBINACAO.test(rotulo)) return null;

    // (2) Exatamente uma categoria neste rótulo…
    const casadas = CATEGORIAS.filter(({ palavra }) => palavra.test(rotulo));
    if (casadas.length !== 1) return null;

    // …e a mesma de todos os outros rótulos empatados.
    if (unica === null) unica = casadas[0].categoria;
    else if (unica !== casadas[0].categoria) return null;
  }

  return unica;
}
