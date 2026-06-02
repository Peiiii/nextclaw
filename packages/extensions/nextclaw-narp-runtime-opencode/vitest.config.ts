import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@opencode-narp": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
