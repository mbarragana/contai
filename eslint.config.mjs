import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Worktrees de agente (Agent tool, isolation: "worktree") têm seu
    // próprio node_modules/.next e não são código versionado desta árvore —
    // já ficam fora do `.gitignore` por padrão, mas o eslint varre a árvore
    // inteira do disco, não só o que o git rastreia.
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
