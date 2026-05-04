import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@dictation/ui": path.resolve(root, "packages/ui/src/index.ts"),
      "@dictation/design-tokens": path.resolve(root, "packages/design-tokens/src/index.ts"),
      "@dictation/domain": path.resolve(root, "packages/domain/src/index.ts"),
      "@dictation/dictation-engine": path.resolve(root, "packages/dictation-engine/src/index.ts"),
      "@dictation/dictionary-engine": path.resolve(root, "packages/dictionary-engine/src/index.ts"),
      "@dictation/import-export": path.resolve(root, "packages/import-export/src/index.ts"),
      "@dictation/audio": path.resolve(root, "packages/audio/src/index.ts"),
      "@dictation/shared": path.resolve(root, "packages/shared/src/index.ts")
    }
  },
  server: {
    port: 5173,
    host: "127.0.0.1"
  },
  build: {
    outDir: "dist",
    sourcemap: true
  }
});
