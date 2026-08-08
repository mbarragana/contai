import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    // Só a lógica pura (fiscal/dinheiro). E2E fica no Playwright, em e2e/.
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
