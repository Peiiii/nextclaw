import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@stdio-runtime-client": new URL("./src", import.meta.url).pathname,
      "@core": new URL("../nextclaw-core/src", import.meta.url).pathname,
      "@nextclaw/shared": new URL("../nextclaw-shared/src/index.ts", import.meta.url).pathname,
    },
  },
});
