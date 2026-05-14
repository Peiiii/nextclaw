import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@codex-plugin-sdk": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
