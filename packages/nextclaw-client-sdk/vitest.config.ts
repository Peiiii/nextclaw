import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@nextclaw/shared": new URL("../nextclaw-shared/src/index.ts", import.meta.url).pathname
    }
  }
});
