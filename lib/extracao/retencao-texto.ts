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
 * ⚠️ **MUDOU NO CONTAI-062, e a mudança é de leitura do parecer, não de
 * doutrina.** Até aqui este bloco afirmava que o módulo "nunca decide o gate
 * `retencao_na_nota`", citando o §3 do parecer
 * `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md` — leitura que o
 * **ADENDO 5** do mesmo parecer desmente por extenso (§0 e §1): o §3 analisou
 * `composicao`/`natureza_da_retencao`/`quem_recolhe`, que são perguntas de
 * **classificação e responsabilidade**, e nunca analisou o gate binário, que é
 * pergunta de **existência** — fato impresso e aritmeticamente conferível, da
 * mesma família de uma data de emissão ou de um CNPJ.
 *
 * Então: **o resultado desta função habilita a sugestão do gate**, e por isso
 * ela não recebe mais o gate como parâmetro (o `gate` que existia aqui saiu no
 * CONTAI-062). O que o ADENDO 5 §3 exige, e que esta assinatura garante por
 * construção:
 *
 * - **§3, salvaguarda 2** — só há o que sugerir quando o par único fecha. Sem
 *   padrão reconhecido o retorno é `null`, e `null` **não é** `"nao_destacada"`:
 *   ausência de padrão não é prova de ausência de retenção. Quem chama não pode
 *   confundir os dois porque não existe valor de retorno que diga "nenhuma".
 * - **§3, salvaguarda 3** — `"nao_sei"` não é representável aqui por nada: um
 *   parser tem "achei" e "não achei", não incerteza a relatar.
 * - **§3, salvaguarda 4** — gate e linha saem da MESMA leitura: o gate se deriva
 *   de `sugestão !== null`, e a sugestão É o `rotuloLiteral`/`valorCentavos`.
 *   Não existe caminho que sugira o gate sem trazer a linha que o motivou.
 *
 * ⚠️ O que continua proibido, sem exceção (ADENDO 5 §4): `notaNoCpf` —
 * pergunta de admissibilidade do documento inteiro, gravidade estrutural
 * diferente — e os quatro campos de classificação abaixo.
 *
 * ⚠️ **Nunca preenche `composicao`, `tributo`, `eDescontoEfetivo` nem
 * `quemRecolhe`** (Gate Fiscal 2, mesma trava do critério 14 do CONTAI-038):
 * esses quatro campos não existem no tipo devolvido aqui, por construção — não
 * é disciplina de quem chama, é o compilador.
 *
 * ⚠️ **QUALIFICADO NO CONTAI-070, e a qualificação é uma decisão de produto que
 * SOBREPÔS a recomendação do `contador`.** A frase acima continua verdadeira
 * **deste tipo**: nenhum dos quatro campos passa a existir aqui. O que mudou é
 * que `composicao` e `tributo` passaram a poder ser sugeridos por FORA, num canal
 * separado — `sugerirTributoDoRotulo` (`tributo-rotulo.ts`) classifica o
 * `rotulosEmpatados` abaixo, e a rota devolve o resultado num campo IRMÃO de
 * `sugestao`, nunca dentro dela. O `contador` reprovou isso "sem exceção"
 * (`docs/pareceres/2026-09-27-extracao-tributo-e-cno.md`, Pergunta 1) e o Mateus
 * decidiu implementar mesmo assim, com a salvaguarda de match único e exclusivo
 * (`docs/backlog/85-2026-09-27-cno-automatico-contraria-contador.md`, ADENDO).
 * `eDescontoEfetivo` e `quemRecolhe` seguem proibidos, sem exceção e sem canal
 * nenhum — ponto unânime entre o `contador` e o Mateus.
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
 * ⚠️ **QUALIFICADO NO CONTAI-068**: "empate real" é empate de **VALOR** entre
 * candidatas — e, dessas, só as que **não** são, isoladamente, terminologia de
 * retenção/tributo. Duas candidatas com o **mesmo** `valorCentavos` sob rótulos
 * diferentes, ambos tributários, são **repetição de leiaute**, não ambiguidade:
 * colapsam numa sugestão só (ADENDO 6 do parecer
 * `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md`). Se qualquer uma
 * das candidatas empatadas tiver vocabulário manifestamente não-tributário
 * (`RE_NAO_TRIBUTARIO`), o empate volta a ser ambiguidade genuína e vira `null`
 * (ADENDO 7 do mesmo parecer). Valores **diferentes** continuam `null` sempre.
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

/**
 * Tipo próprio, **fora do `ExtracaoDocumentoSchema`** (critério 6 do
 * CONTAI-054): produtor diferente (parser determinístico, não modelo), gatilho
 * diferente (o PDF anexado, não o clique em "extrair automaticamente") e sem
 * `confianca`. Mapeia nos dois únicos campos de `EntradaLinhaRetencao` que são
 * leitura de texto impresso.
 */
export type SugestaoLinhaRetencao = {
  /** O rótulo como está impresso na nota — copiado, nunca traduzido. */
  rotuloLiteral: string;
  /** Sempre > 0: linha de retenção de valor zero não é sugestão, é ruído. */
  valorCentavos: number;
  /**
   * **NOVO — CONTAI-070, critério 2.** TODOS os rótulos que colapsaram nesta
   * mesma linha (mesmo `valorCentavos`, colapso do CONTAI-068), na ordem de
   * aparição no texto. `rotuloLiteral` é sempre o primeiro deles.
   *
   * ⚠️ **Existe porque o primeiro rótulo não basta para classificar**: se "Valor
   * ISS" e "ISSRF" imprimem o mesmo número, os dois concordam e a categoria é
   * ISS; se colapsassem dois rótulos de categorias diferentes, escolher o
   * primeiro seria classificar por ordem de impressão. Quem lê este campo é
   * `sugerirTributoDoRotulo` (`tributo-rotulo.ts`), e ele exige unanimidade.
   *
   * Campo ADITIVO e de leitura: não muda nada do que já existia, e continua sendo
   * texto impresso copiado — nunca classificação.
   */
  rotulosEmpatados: string[];
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

/**
 * **Triagem do CONTAI-068 / ADENDO 7** — vocabulário manifestamente
 * NÃO-tributário, usado **só** para decidir se duas candidatas empatadas em
 * valor podem colapsar. Não é filtro de candidata: uma linha "Desconto ..." que
 * feche a conta **sozinha** continua sendo sugerida como sempre foi (o rótulo
 * nunca decide papel — a aritmética decide).
 *
 * Por que isto **não** é a whitelist vetada pelo Critério 4 / ADENDO 6 §4: lá o
 * veto é a *preferência* por um rótulo de retenção sobre outro no desempate
 * (`"ISSRF" > "Valor ISS"`); aqui a pergunta é anterior e mais grosseira — "as
 * duas candidatas descrevem sequer o mesmo fato tributário, ou uma delas é
 * claramente outra coisa que só bateu no número?" (ADENDO 7).
 *
 * A lista é **genérica** de propósito — vocabulário universal de contabilidade,
 * nunca jargão de prefeitura ou de sistema emissor. Acrescentar termo específico
 * de município aqui repetiria, por outra porta, o acoplamento que o Critério 4
 * evita por desenho: passa pelo `contador` antes (pre-mortem 3 do CONTAI-068).
 */
const RE_NAO_TRIBUTARIO = /desconto|abatimento|frete|parcela|acr[eé]scimo/i;

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
 * ⚠️ **Sem parâmetro de gate desde o CONTAI-062**: a resposta do Mateus ao gate
 * não entra mais nesta decisão, porque agora é ela que pode nascer daqui
 * (ADENDO 5 §1/§3). Quem decide o que fazer com o `null` é quem chama — e `null`
 * nunca autoriza `"nao_destacada"` nem `"nao_sei"` (salvaguardas 2 e 3).
 *
 * @param texto texto embutido do PDF, já extraído por `extrairTextoDoPdf`
 */
export function sugerirLinhaRetencao(texto: string): SugestaoLinhaRetencao | null {
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

  // Chaveado por **VALOR** (`valorCentavos`), não por `rótulo|valor` — mudou no
  // CONTAI-068, e a mudança é do parecer, não de conveniência:
  //
  // - o que interessa é quantos VALORES de retenção distintos a nota admite, não
  //   quantos pares chegaram a fechar nem quantos nomes o leiaute deu ao mesmo
  //   número. Nota que imprime o total duas vezes (rótulos diferentes, valor
  //   igual) fecha duas combinações apontando para a MESMA linha — repetição,
  //   não ambiguidade;
  // - **a própria linha de retenção repetida sob dois rótulos, mesmo valor,
  //   também é repetição** (ADENDO 6 do parecer
  //   `docs/pareceres/2026-09-18-retencao-variavel-servico-pj.md`): é o caso real
  //   de Palhoça/SC, em que "Valor ISS" (bloco do item) e "ISSRF" (resumo
  //   financeiro) imprimem o mesmo número. A chave antiga por rótulo contava isso
  //   como duas sugestões e zerava a nota — o bug do CONTAI-068. Não há escolha
  //   de VALOR a fazer aqui (o empate pressupõe valor idêntico, já conferido pela
  //   aritmética), só de qual texto exibir para o Mateus achar a linha no papel;
  // - quem desempata o texto é a **ordem de aparição** (primeiro vence), critério
  //   estrutural. Preferir um vocabulário de prefeitura/emissor é vetado
  //   (ADENDO 6 §4 / Critério 4 do cabeçalho);
  // - **o limite** (ADENDO 7): colapsar é privilégio do caso comprovado — as duas
  //   candidatas empatadas serem, isoladamente, terminologia de retenção. Se uma
  //   delas for manifestamente não-tributária (`RE_NAO_TRIBUTARIO`: desconto,
  //   frete, parcela…), o valor igual é coincidência numérica entre dois
  //   conceitos, não repetição de um só — segue ambiguidade genuína, segue
  //   `null`. É o falso positivo que o ADENDO 5 §2 já havia nomeado.
  //
  // Valor igual → mesma chave; valores diferentes → chaves diferentes → `null`,
  // exatamente como antes.
  const sugestoes = new Map<number, Set<string>>();

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
        const rotulos = sugestoes.get(candidata.valorCentavos);
        if (rotulos === undefined) {
          sugestoes.set(candidata.valorCentavos, new Set([candidata.rotulo]));
        } else {
          rotulos.add(candidata.rotulo);
        }
      }
    }
  }

  // Zero é "não reconheci o padrão"; mais de um VALOR é ambiguidade. As duas
  // viram o mesmo resultado de propósito (critério 2).
  if (sugestoes.size !== 1) return null;
  const [valorCentavos, rotulos] = [...sugestoes.entries()][0];

  // Triagem do ADENDO 7, antes de aceitar o colapso: só há empate de rótulo a
  // colapsar quando NENHUMA das candidatas empatadas é manifestamente
  // não-tributária. Com uma candidata só, o rótulo nunca é filtrado — a
  // aritmética é quem decide papel (nota 2 real: "Total das Retenções (ISSQN /
  // Federais)" tem "total" dentro e é a retenção).
  if (rotulos.size > 1 && [...rotulos].some((rotulo) => RE_NAO_TRIBUTARIO.test(rotulo))) {
    return null;
  }

  // Desempate ESTRUTURAL: vence o rótulo que aparece primeiro no texto.
  // `candidatas` preserva a ordem de `extrairLinhasRotuladas`, então varrer
  // aqui — em vez de confiar na ordem de inserção no `Map`, que depende da
  // ordem dos laços total × líquido — faz o critério valer por construção, em
  // qualquer direção do texto (CONTAI-068, critério 4).
  //
  // ⚠️ **CONTAI-070 — a MESMA varredura produz o conjunto empatado.** Ela já
  // existia para achar o primeiro rótulo; agora devolve os dois fatos que saem
  // dela (o primeiro e o conjunto inteiro, na ordem do texto) em vez de jogar o
  // resto fora. Derivar `rotuloLiteral` de `rotulosEmpatados[0]` é o que garante,
  // por construção, que os dois nunca discordem sobre qual é o primeiro.
  const rotulosEmpatados: string[] = [];
  for (const candidata of candidatas) {
    if (candidata.valorCentavos !== valorCentavos) continue;
    if (!rotulos.has(candidata.rotulo)) continue;
    if (rotulosEmpatados.includes(candidata.rotulo)) continue;
    rotulosEmpatados.push(candidata.rotulo);
  }
  // Inalcançável: todo rótulo do `Map` saiu de uma candidata. `null` em vez de
  // `!` porque, se algum dia deixar de ser verdade, o certo é não sugerir.
  if (rotulosEmpatados.length === 0) return null;

  return { rotuloLiteral: rotulosEmpatados[0], valorCentavos, rotulosEmpatados };
}
