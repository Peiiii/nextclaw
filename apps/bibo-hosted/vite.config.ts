import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  publicDir: "static",
  build: { outDir: "dist/public", emptyOutDir: true },
  server: {
    proxy: { "/api": { target: "http://127.0.0.1:8787", changeOrigin: true } },
  },
});
