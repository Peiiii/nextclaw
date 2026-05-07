import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@kernel": path.resolve(__dirname, "../nextclaw-kernel/src"),
    },
  },
});
