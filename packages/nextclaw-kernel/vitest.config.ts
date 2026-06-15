import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@kernel": fileURLToPath(new URL("./src", import.meta.url)),
      "@core": fileURLToPath(new URL("../nextclaw-core/src", import.meta.url)),
      "@stdio-runtime-client": fileURLToPath(
        new URL("../nextclaw-ncp-runtime-stdio-client/src", import.meta.url),
      ),
    },
  },
});
