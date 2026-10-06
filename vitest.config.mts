import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    // Só a lógica pura (fiscal/dinheiro). E2E fica no Playwright, em e2e/.
    //
    // ⚠️ `app/**` entrou no CONTAI-089 para um módulo puro que mora JUNTO da
    // rota de propósito (`compra-cartao/texto-herdado.ts`): ele é mecanismo de
    // duas telas, e subir para `lib/` o transformaria em dependência de regra
    // fiscal, que é exatamente a confusão entre "herdar texto" e "herdar
    // vínculo" que o ticket recusa. Só `.test.ts` — nenhum `.tsx`: não há
    // ambiente de DOM aqui, e componente se prova no Playwright.
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
    environment: "node",
  },
});
