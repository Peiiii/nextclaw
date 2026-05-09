import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@core": new URL("./src", import.meta.url).pathname,
      "@nextclaw/shared": new URL("../nextclaw-shared/src/index.ts", import.meta.url).pathname
    }
  }
});
