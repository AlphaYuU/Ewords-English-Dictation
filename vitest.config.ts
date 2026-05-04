import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@dictation/domain": new URL("./packages/domain/src/index.ts", import.meta.url).pathname,
      "@dictation/dictation-engine": new URL("./packages/dictation-engine/src/index.ts", import.meta.url).pathname,
      "@dictation/import-export": new URL("./packages/import-export/src/index.ts", import.meta.url).pathname,
    },
  },
});
