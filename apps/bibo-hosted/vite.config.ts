import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { biboUiDevController } from "./scripts/bibo-ui-dev.controller";

export default defineConfig(({ mode }) => ({
  plugins: [tailwindcss(), react(), ...(mode === "ui" ? [biboUiDevController()] : [])],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  publicDir: "static",
  build: { outDir: "dist/public", emptyOutDir: true },
  server: {
    proxy: mode === "ui" ? undefined : { "/api": { target: "http://127.0.0.1:8787", changeOrigin: true } },
  },
}));
