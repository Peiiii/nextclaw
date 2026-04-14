import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const apiBase = (process.env.VITE_PUBLIC_ROADMAP_FEEDBACK_PORTAL_API_BASE ?? "http://127.0.0.1:3196").replace(/\/+$/, "");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./shared")
    }
  },
  server: {
    host: "127.0.0.1",
    port: 5186,
    strictPort: true,
    proxy: {
      "/api": {
        target: apiBase,
        changeOrigin: true
      },
      "/health": {
        target: apiBase,
        changeOrigin: true
      }
    }
  }
});
