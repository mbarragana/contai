/**
 * **CONTAI-054 — sugestão determinística de rótulo/valor da linha de retenção.**
 * Módulo puro: sem rede, sem Gemini, sem Groq. Só o texto que o `unpdf` já
 * extraiu localmente (estágio 1 do `texto-pdf.ts`, CONTAI-052).
 *
 * ## O que ele decide, e o que ele nunca decide
 *
 * Decide: "existe no texto um trio rotulado (total, líquido, terceiro) em que a
 * aritmética `total − terceiro = líquido` fecha?". Se sim, o terceiro rótulo e
 * o terceiro valor vão para o formulário **como sugestão a confirmar**.
 *
 * ⚠️ **Nunca decide o gate** `retencao_na_nota` (critério 1 e Gate Fiscal 1:
 * parecer `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md` §3 — o
 * gate é fato afirmado pelo Mateus, não leitura de campo). Qualquer `gate`
 * diferente de `"destacada"` sai por `null` antes de olhar o texto.
 *
 * ⚠️ **Nunca preenche `composicao`, `tributo`, `eDescontoEfetivo` nem
 * `quemRecolhe`** (Gate Fiscal 2, mesma trava do critério 14 do CONTAI-038):
 * esses quatro campos não existem no tipo devolvido aqui, por construção — não
 * é disciplina de quem chama, é o compilador.
 *
 * ⚠️ **Não tem `confianca`** (Gate Fiscal 3): aritmética batendo é
 * pré-condição de escopo, não voto sobre a legibilidade do texto-fonte.
 * Promover confiança por conta fechando inverteria a regra "rebaixa nunca
 * sobe" de `conferirContraFonte`.
 *
 * ## Por que o reconhecimento é estrutural, e não uma lista de rótulos
 *
 * Critério 4: nenhum rótulo de emissor/município ("ISSRF", "ISS RETIDO", …)
 * aparece hardcoded. O que se procura é o vocabulário genérico de qualquer
 * nota — "total" e "líquido" — mais a aritmética. Rótulo de retenção varia por
 * prefeitura e por sistema emissor; whitelist envelheceria na terceira nota.
 *
 * ## Por que a busca é COMBINATÓRIA
 *
 * Confirmado no segundo exemplo real (2026-09-25, layout DANFSe v2.0/NFS-e
 * Nacional): a MESMA nota tem mais de um rótulo casando com "total" ("VALOR
 * TOTAL DA NFS-e" e o "Valor Total Apurado" do IBS/CBS) e mais de um casando
 * com "líquido" ("VALOR LÍQUIDO DA NFS-e" e "VALOR LÍQUIDO DA NFS-e +
 * IBS/CBS", zerado por ser campo da reforma tributária ainda não vigente).
 * "Primeiro que achar" pegaria o par errado e sugeriria um valor inventado.
 * Então: testam-se TODAS as combinações e a aritmética é quem desempata.
 *
 * Empate real vira `null` — ambiguidade nunca vira "melhor palpite"
 * (critério 2).
 *
 * ## O que a MEDIÇÃO com as notas reais corrigiu (2026-09-25)
 *
 * A primeira versão deste módulo foi escrita contra fixture reconstruída e
 * errava em duas premissas — as duas desmentidas rodando o `unpdf` nas duas
 * notas reais do ticket:
 *
 * 1. **Rótulo e valor não vêm na mesma linha.** O PDF.js emite um item de texto
 *    por célula da tabela, então "Valor Total" e "21.430,00" chegam como duas
 *    linhas consecutivas. `extrairLinhasRotuladas` cobre os dois padrões.
 * 2. **A linha de retenção pode se chamar "Total …"** — na nota 2 ela é "Total
 *    das Retenções (ISSQN / Federais)". Filtrar candidata pelo vocabulário do
 *    rótulo derrubava justamente essa nota.
 */

import { parseValorInput } from "@/lib/money";
import type { RespostaRetencaoNaNota } from "@/lib/types";

/**
 * Tipo próprio, **fora do `ExtracaoDocumentoSchema`** (critério 6): produtor
 * diferente (parser determinístico, não modelo), timing diferente (só depois
 * do gate) e sem `confianca`. Mapeia nos dois únicos campos de
 * `EntradaLinhaRetencao` que são leitura de texto impresso.
 */
export type SugestaoLinhaRetencao = {
  /** O rótulo como está impresso na nota — copiado, nunca traduzido. */
  rotuloLiteral: string;
  /** Sempre > 0: linha de retenção de valor zero não é sugestão, é ruído. */
  valorCentavos: number;
};

/**
 * Gate Fiscal 4: `|Total − Retenção − Líquido| ≤ 0,01` conta como "bate".
 * Aritmética em centavos inteiros — nunca float com 0,01 (Viabilidade/CTO).
 */
export const TOLERANCIA_CENTAVOS = 1;

/**
 * Rótulo de campo de nota é curto. Acima disso o que veio antes do valor é
 * frase — tipicamente a discriminação do serviço terminando em número —, e
 * sugerir um parágrafo como "rótulo literal" só daria trabalho de apagar.
 */
export const LIMITE_CARACTERES_ROTULO = 60;

/** O vocabulário genérico. Sem acento obrigatório: nota imprime os dois jeitos. */
const RE_TOTAL = /total/i;
const RE_LIQUIDO = /l[íi]quido/i;

/**
 * Valor pt-BR com exatamente duas casas — a mesma forma que `texto-pdf.ts`
 * usa como âncora, aqui na versão global e com duas guardas a mais:
 *
 * - `(?![\d.,]*\d)` à direita e `(?<![\d.,])` à esquerda: `1.234,56` não casa
 *   dentro de `41.234,567`. É a mesma fronteira de `apareceComoNumero`, pelo
 *   mesmo motivo (errar por fator de 1000 é o erro mais caro do custo).
 * - `(?!\s*%)`: **alíquota não é valor.** "Alíquota ISS 2,00% ... 632,00"
 *   colocaria `2,00` na lista de linhas e deixaria o rótulo do valor de
 *   verdade como `%`.
 */
const RE_VALOR_ROTULADO = /(?<![\d.,])(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}(?![\d.,]*\d)(?!\s*%)/g;

/**
 * Pontuação de alinhamento e moeda: a régua de pontos, `:`, `R$`, `|`, `-`.
 * Parêntese fica de fora de propósito — em "ISS (3%)" ele faz parte do rótulo
 * impresso, e cortá-lo devolveria "ISS (3%", que não está escrito em nota
 * nenhuma.
 */
const RE_BORDA_ROTULO = /(?:R\$|[.:;=,\-–—_·•|/\\\s])+/;
const RE_FIM_ROTULO = new RegExp(`${RE_BORDA_ROTULO.source}$`, "u");
const RE_INICIO_ROTULO = new RegExp(`^${RE_BORDA_ROTULO.source}`, "u");

/** Uma linha rotulada do texto: o rótulo impresso e o valor ao lado dele. */
type LinhaRotulada = {
  rotulo: string;
  valorCentavos: number;
};

/**
 * O texto antes do valor, limpo do que é alinhamento e não rótulo. `null`
 * quando não sobra rótulo nenhum (valor solto, célula vazia) ou quando o que
 * sobrou é frase, não rótulo.
 */
function limparRotulo(bruto: string): string | null {
  const umaLinha = bruto.replace(/\s+/g, " ");
  const rotulo = umaLinha
    .replace(RE_FIM_ROTULO, "")
    .replace(RE_INICIO_ROTULO, "")
    .trim();

  if (rotulo.length === 0 || rotulo.length > LIMITE_CARACTERES_ROTULO) return null;
  // Sem nenhuma letra não é rótulo: é resto de código de barras ou de chave de
  // acesso que sobrou entre dois valores.
  if (!/\p{L}/u.test(rotulo)) return null;
  return rotulo;
}

/**
 * A linha é só um valor — nada além dele, tirando `R$` e pontuação de
 * alinhamento. É a metade de baixo de uma célula de tabela. `null` quando a
 * linha não é isso (nenhum valor, mais de um valor, ou sobra texto que seria
 * rótulo).
 */
function valorSozinhoNaLinha(linha: string | undefined): number | null {
  if (linha === undefined) return null;

  const achados = [...linha.matchAll(RE_VALOR_ROTULADO)];
  if (achados.length !== 1) return null;

  const resto = linha.replace(achados[0][0], " ").replace(/R\$/g, " ");
  if (!/^[\s.:;=,\-–—_·•|/\\]*$/u.test(resto)) return null;

  return parseValorInput(achados[0][0]);
}

/**
 * Quebra o texto em pares rótulo→valor, em DOIS padrões — os dois observados em
 * texto que o `unpdf` devolve de verdade.
 *
 * **(a) Mesma linha**: `"Valor Total 31.600,00 Valor Líquido 30.968,00"`. O
 * rótulo de cada valor é o trecho entre o fim do valor anterior e o começo
 * deste, então uma linha pode render vários pares.
 *
 * **(b) Rótulo numa linha, valor na seguinte** — ⚠️ **e este é o padrão
 * dominante nas duas notas reais do ticket, medido com o `unpdf` em
 * 2026-09-25**, não hipótese: o PDF.js emite um item de texto por CÉLULA da
 * tabela, então a célula visual "Valor Total / 21.430,00" chega como duas
 * linhas consecutivas. A versão anterior deste módulo só cobria (a) e devolvia
 * `null` nas duas notas que motivaram o ticket — a correção fecha a dívida D75.
 *
 * O par (b) só se forma quando a correspondência é inequívoca: a linha do
 * rótulo não tem valor nenhum, a seguinte é só o valor, e a seguinte a essa
 * **não** é outro valor solto. Esse último guarda contra o layout em que a
 * tabela despeja todos os rótulos e só depois todos os valores — ali
 * adjacência deixa de significar correspondência, e casar "Valor Líquido" com
 * o primeiro número da pilha produziria um par falso (com valor 1000x errado,
 * o erro mais caro do custo de aquisição).
 */
function extrairLinhasRotuladas(texto: string): LinhaRotulada[] {
  const linhas: LinhaRotulada[] = [];
  // Linha em branco entre rótulo e valor é ruído de paginação, não separação de
  // campo: se ficasse, quebraria o par (b) por nada.
  const brutas = texto.split(/\r?\n/).filter((linha) => linha.trim() !== "");

  for (let i = 0; i < brutas.length; i += 1) {
    const linhaBruta = brutas[i];
    const achados = [...linhaBruta.matchAll(RE_VALOR_ROTULADO)];

    if (achados.length > 0) {
      // (a) mesma linha.
      let cursor = 0;
      for (const achado of achados) {
        const inicio = achado.index;
        const rotulo = limparRotulo(linhaBruta.slice(cursor, inicio));
        cursor = inicio + achado[0].length;
        if (rotulo === null) continue;

        const valorCentavos = parseValorInput(achado[0]);
        if (valorCentavos === null) continue;

        linhas.push({ rotulo, valorCentavos });
      }
      // Linha que já tem valor nunca entra em (b): seria contar duas vezes.
      continue;
    }

    // (b) célula de tabela quebrada em duas linhas.
    const rotulo = limparRotulo(linhaBruta);
    if (rotulo === null) continue;

    const valorCentavos = valorSozinhoNaLinha(brutas[i + 1]);
    if (valorCentavos === null) continue;
    if (valorSozinhoNaLinha(brutas[i + 2]) !== null) continue;

    linhas.push({ rotulo, valorCentavos });
  }

  return linhas;
}

/**
 * A sugestão do CONTAI-054. `null` sempre que houver qualquer dúvida —
 * incluindo dúvida por excesso de resposta.
 *
 * @param texto texto embutido do PDF, já extraído por `extrairTextoDoPdf`
 * @param gate a resposta ATUAL do Mateus ao gate de retenção. Só `"destacada"`
 *   habilita a leitura; `null` e `"nenhuma"` saem por `null` sem tocar o texto.
 */
export function sugerirLinhaRetencao(
  texto: string,
  gate: RespostaRetencaoNaNota | null,
): SugestaoLinhaRetencao | null {
  // Critério 1 / Gate Fiscal 1: o parser não participa da decisão do gate, em
  // nenhuma direção. Antes de qualquer leitura, para ficar óbvio que não há
  // caminho em que o texto influencie essa resposta.
  if (gate !== "destacada") return null;

  const linhas = extrairLinhasRotuladas(texto);

  const totais = linhas.filter((linha) => RE_TOTAL.test(linha.rotulo));
  const liquidos = linhas.filter((linha) => RE_LIQUIDO.test(linha.rotulo));
  // A candidata à retenção é qualquer linha rotulada com valor > 0 (critério 2).
  //
  // ⚠️ **Não se filtra por rótulo aqui**, e isso é medição, não preferência: na
  // nota 2 real a linha de retenção se chama "Total das Retenções (ISSQN /
  // Federais)" — tem a palavra "total" dentro. Excluir candidata por casar com
  // /total/i (como esta função fazia antes) matava exatamente uma das duas notas
  // que motivaram o ticket. O que separa os papéis é a ARITMÉTICA e a
  // identidade da linha, não o vocabulário do rótulo.
  const candidatas = linhas.filter((linha) => linha.valorCentavos > 0);

  // Chaveado por `rótulo|valor`: o que interessa é quantas sugestões DISTINTAS
  // a nota admite, não quantos pares chegaram a fechar. Nota que imprime o
  // total duas vezes (com rótulos diferentes, valor igual) fecha duas
  // combinações apontando para a MESMA linha — isso não é ambiguidade, é
  // repetição, e recusar aí seria recusar o caso simples de quase toda nota.
  // Dois rótulos diferentes com o mesmo valor, esses sim, são ambiguidade
  // genuína: qual dos dois copiar é indecidível pela estrutura.
  const sugestoes = new Map<string, SugestaoLinhaRetencao>();

  for (const total of totais) {
    for (const liquido of liquidos) {
      // Rótulo que contém as duas palavras ("VALOR TOTAL LÍQUIDO") entra nas
      // duas listas; a mesma linha não pode ser os dois lados da conta.
      if (total === liquido) continue;

      // Líquido zerado nunca é o líquido da nota: é campo não vigente (os
      // "VALOR LÍQUIDO DA NFS-e + IBS/CBS" da reforma tributária vêm R$ 0,00 nas
      // duas notas reais). Aceitá-lo como perna da conta faria a diferença ser o
      // total inteiro — e aí qualquer linha que repete o total (uma "Base de
      // Cálculo", por exemplo) fecharia um trio falso e derrubaria a nota por
      // ambiguidade inventada. Nenhum verdadeiro positivo se perde aqui: líquido
      // zero exigiria retenção de 100% da nota.
      if (liquido.valorCentavos <= 0) continue;

      const diferenca = total.valorCentavos - liquido.valorCentavos;
      // Líquido ≥ total significa papéis trocados, nunca uma retenção — e a
      // candidata tem que ser > 0.
      if (diferenca <= 0) continue;

      for (const candidata of candidatas) {
        // A mesma linha não pode ser dois papéis da conta ("terceira linha").
        if (candidata === total || candidata === liquido) continue;
        if (Math.abs(diferenca - candidata.valorCentavos) > TOLERANCIA_CENTAVOS) {
          continue;
        }
        sugestoes.set(`${candidata.rotulo}|${candidata.valorCentavos}`, {
          rotuloLiteral: candidata.rotulo,
          valorCentavos: candidata.valorCentavos,
        });
      }
    }
  }

  // Zero é "não reconheci o padrão"; mais de uma é ambiguidade. As duas viram
  // o mesmo resultado de propósito (critério 2).
  if (sugestoes.size !== 1) return null;
  return [...sugestoes.values()][0];
}
