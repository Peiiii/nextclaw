import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@/": new URL("./src/", import.meta.url).pathname,
      "@core/": new URL("../nextclaw-core/src/", import.meta.url).pathname,
      "@core": new URL("../nextclaw-core/src", import.meta.url).pathname,
      "@kernel/": new URL("../nextclaw-kernel/src/", import.meta.url).pathname,
      "@kernel": new URL("../nextclaw-kernel/src", import.meta.url).pathname,
      "@nextclaw/core": new URL("../nextclaw-core/src/index.ts", import.meta.url).pathname,
      "@nextclaw/kernel": new URL("../nextclaw-kernel/src/index.ts", import.meta.url).pathname,
      "@nextclaw/shared": new URL("../nextclaw-shared/src/index.ts", import.meta.url).pathname
    }
  }
});
