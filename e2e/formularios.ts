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
  arquivo: Anexo;
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
  await page.getByLabel("Arquivo").setInputFiles(dados.arquivo);
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

export interface PagamentoBasico {
  favorecido: string;
  documento: string;
  valor: string;
  /** ISO — é DELA que sai o ano-calendário do custo (regime de caixa). */
  dataPagamento: string;
  comprovante?: Anexo;
}

/** `/adicionar/pagamento` até antes do "Salvar". */
export async function preencherPagamentoBasico(
  page: Page,
  dados: PagamentoBasico,
) {
  await page.getByLabel("Favorecido", { exact: true }).fill(dados.favorecido);
  await page.getByLabel("CNPJ / CPF do favorecido").fill(dados.documento);
  await page.getByLabel("Valor").fill(dados.valor);
  await page.getByLabel("Data do pagamento").fill(dados.dataPagamento);
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
