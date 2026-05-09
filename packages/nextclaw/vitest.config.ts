import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@core": path.resolve(__dirname, "../nextclaw-core/src"),
      "@nextclaw-service": path.resolve(__dirname, "../nextclaw-service/src"),
      "@nextclaw/shared": path.resolve(__dirname, "../nextclaw-shared/src/index.ts"),
      "@kernel": path.resolve(__dirname, "../nextclaw-kernel/src"),
    },
  },
});
