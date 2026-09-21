import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { lerCamposDoSpec, type SpecLido } from "./campos-do-spec";

/**
 * Leitura de `design/mocks/*.md` do disco. Separado do parser de propósito: o
 * parser é função pura (string → campos) e o `node:fs` fica só aqui, onde o
 * Vitest e o Playwright chegam e o bundle do Next nunca chega.
 */

/**
 * ⚠️ `process.cwd()`, e não `import.meta.url`: o transpilador do Playwright
 * roda o spec como CommonJS e `import.meta` não existe lá. Vitest e Playwright
 * partem os dois da raiz do repo; se um dia não partirem, a checagem abaixo
 * falha dizendo o que houve, em vez de devolver "nenhum spec".
 */
export const PASTA_MOCKS = join(process.cwd(), "design", "mocks");

/** Os ids dos specs (`CONTAI-019`), em ordem. */
export function specsExistentes(): string[] {
  if (!existsSync(PASTA_MOCKS)) {
    throw new Error(
      `não achei ${PASTA_MOCKS}: rode a suíte a partir da raiz do repositório`,
    );
  }
  return readdirSync(PASTA_MOCKS)
    .filter((nome) => nome.endsWith(".md") && nome !== "index.md")
    .map((nome) => nome.replace(/\.md$/, ""))
    .sort();
}

/** Lê e parseia TODOS os specs. Erro de gramática volta dentro de cada um. */
export function lerTodosOsSpecs(): SpecLido[] {
  return specsExistentes().map((spec) =>
    lerCamposDoSpec(spec, readFileSync(join(PASTA_MOCKS, `${spec}.md`), "utf8")),
  );
}
