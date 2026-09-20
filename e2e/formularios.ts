import { expect, type Page } from "@playwright/test";

import { EMAIL_SEED, SENHA_SEED } from "./ambiente";

/**
 * Preenchimento dos dois formulários de captura, em UM lugar.
 *
 * Por que existe (chore do CONTAI-004, R4 do Gate 4 do CONTAI-002): o
 * preenchimento estava copiado em `ingestao.spec.ts`, `obra.spec.ts` e
 * `entrar.spec.ts`, e campo novo obrigatório — que é exatamente o que este
 * ticket acrescenta — obrigava a caçar cada cópia. Pior: a cópia esquecida
 * falha com "não salva", que se lê como bug do produto e não como teste
 * desatualizado.
 *
 * ⚠️ Estes helpers preenchem o CAMINHO BÁSICO, e nada mais. Quem testa uma
 * regra preenche o campo dela no próprio teste, à vista de quem lê: esconder a
 * data de emissão dentro de um helper seria esconder a regra fiscal que o
 * teste existe para provar.
 */

/** Escolhe uma opção de um grupo de rádio (`Escolha`). */
export async function escolher(page: Page, grupo: string, opcao: string) {
  await page
    .getByRole("group", { name: grupo })
    .getByText(opcao, { exact: true })
    .click();
}

export interface Anexo {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

export interface DocumentoBasico {
  /** Rótulo do tipo, como aparece na tela: "NF material", "NF serviço"… */
  tipo: string;
  emitente: string;
  /** CNPJ/CPF do emitente, formatado ou não. */
  documento: string;
  valor: string;
  /**
   * ⚠️ **OPCIONAL desde o CONTAI-033**: a nota grava sem o arquivo (parecer
   * ADENDO 1 §A.3), e deixar de fora é como o teste chega ao diálogo do §A.7.1.
   */
  arquivo?: Anexo;
  /**
   * Número da nota — CONTAI-004, R2: vai LITERAL para o campo, sem
   * normalização nenhuma, e é assim que o teste confere o que foi gravado.
   */
  numero?: string;
  /** Série — campo PRÓPRIO (R6), opcional: nem toda NFS-e tem série. */
  serie?: string;
  /** Data de emissão (ISO, como o input `date` espera). SEM default (R3). */
  dataEmissao?: string;
  /** "Sim" | "Não" — deixe de fora para testar a ausência de resposta. */
  noCpf?: "Sim" | "Não";
}

/**
 * `/adicionar/documento` até antes do "Salvar registro".
 *
 * Número e data de emissão só são digitados quando vêm nos dados: é assim que
 * o teste do campo faltante consegue chegar ao botão com o campo vazio.
 */
export async function preencherDocumentoBasico(
  page: Page,
  dados: DocumentoBasico,
) {
  if (dados.arquivo) {
    await page.getByLabel("Arquivo").setInputFiles(dados.arquivo);
  }
  await escolher(page, "Tipo", dados.tipo);
  if (dados.numero !== undefined) {
    await page.getByLabel("Número da nota").fill(dados.numero);
  }
  if (dados.serie !== undefined) {
    await page.getByLabel("Série (quando houver)").fill(dados.serie);
  }
  if (dados.dataEmissao !== undefined) {
    await page.getByLabel("Data de emissão").fill(dados.dataEmissao);
  }
  await page.getByLabel("Emitente", { exact: true }).fill(dados.emitente);
  await page.getByLabel("CNPJ / CPF do emitente").fill(dados.documento);
  await page.getByLabel("Valor").fill(dados.valor);
  if (dados.noCpf) {
    await escolher(page, "A nota está no seu CPF?", dados.noCpf);
  }
}

/**
 * A resposta do CNO impresso — CONTAI-007, critério 1. **Só NF de serviço**, e
 * bloqueante desde este ticket: sem ela o formulário não salva.
 *
 * ⚠️ Fica FORA de `preencherDocumentoBasico` de propósito, como `numero` e
 * `dataEmissao` ficaram no CONTAI-004: esconder uma regra fiscal dentro de um
 * helper é esconder o que o teste existe para provar. Quem registra NF de
 * serviço chama esta linha à vista de quem lê.
 *
 * ⚠️ "É o CNO desta obra" **não existe quando a obra não tem CNO** — nenhuma
 * nota pode trazer impresso um número que não existe.
 */
export async function responderCnoDaNota(
  page: Page,
  opcao: "É o CNO desta obra" | "É o CNO de outra obra" | "A nota não traz CNO",
) {
  await escolher(page, "Qual CNO está impresso nesta nota?", opcao);
}

export interface PagamentoBasico {
  favorecido: string;
  documento: string;
  valor: string;
  /** ISO — é DELA que sai o ano-calendário do custo (regime de caixa). */
  dataPagamento: string;
  /**
   * CONTAI-032: SEM DEFAULT, cada teste escolhe. "PIX" | "Boleto" | "Cartão",
   * como o texto aparece na tela.
   */
  meio: "PIX" | "Boleto" | "Cartão";
  comprovante?: Anexo;
}

/**
 * `/adicionar/pagamento` até antes do "Salvar".
 *
 * ⚠️ Meio antes de Data (CONTAI-032): o rótulo do campo de data é "Data" até
 * Meio e Data existirem os dois — locar por "Data do pagamento" antes disso
 * não encontra nada. Selecionar Meio primeiro não muda o rótulo (ele só sai
 * do neutro depois que Data TAMBÉM for preenchida), então o `fill` abaixo usa
 * o rótulo neutro de propósito.
 */
export async function preencherPagamentoBasico(
  page: Page,
  dados: PagamentoBasico,
) {
  await page.getByLabel("Favorecido", { exact: true }).fill(dados.favorecido);
  await page.getByLabel("CNPJ / CPF do favorecido").fill(dados.documento);
  await escolher(page, "Como foi pago", dados.meio);
  await page.getByLabel("Valor").fill(dados.valor);
  await page.getByLabel("Data", { exact: true }).fill(dados.dataPagamento);
  if (dados.comprovante) {
    await page.getByLabel("Comprovante").setInputFiles(dados.comprovante);
  }
}

/**
 * Login pela tela de verdade (`/entrar`), com o retry que o campo controlado
 * do React exige: hidratação a meio caminho engole o `fill`.
 *
 * Mora aqui, e não em `entrar.spec.ts`, desde o CONTAI-004: o cenário "a
 * sessão cai no meio do formulário" saiu daquele arquivo para um spec com o
 * nome do que ele testa, e passou a precisar deste helper também.
 */
export async function entrarPelaTela(
  page: Page,
  email: string = EMAIL_SEED,
  senha: string = SENHA_SEED,
) {
  const campoEmail = page.getByLabel("Seu e-mail");
  const campoSenha = page.getByLabel("Sua senha");

  await expect(async () => {
    await campoEmail.fill(email);
    await campoSenha.fill(senha);
    await expect(campoEmail).toHaveValue(email, { timeout: 1_000 });
    await expect(campoSenha).toHaveValue(senha, { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });

  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}
