import { builtinModules } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const nodeExternals = [...builtinModules, ...builtinModules.map((moduleName) => `node:${moduleName}`)];

export default defineConfig({
  resolve: {
    alias: {
      "@dictation/data-access": path.resolve(root, "packages/data-access/src/index.ts"),
      "@dictation/domain": path.resolve(root, "packages/domain/src/index.ts"),
    },
  },
  build: {
    ssr: path.resolve(root, "apps/desktop/electron/main/main.ts"),
    outDir: path.resolve(root, "apps/desktop/dist-electron"),
    emptyOutDir: true,
    target: "node22",
    sourcemap: process.env.VITE_ENABLE_SOURCEMAP === "1",
    rollupOptions: {
      external: ["electron", ...nodeExternals],
      output: {
        format: "es",
        entryFileNames: "main/main.js",
        chunkFileNames: "chunks/[name]-[hash].js",
      },
    },
  },
});
