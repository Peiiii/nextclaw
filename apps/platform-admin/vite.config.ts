import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const apiBase = process.env.VITE_PLATFORM_API_BASE ?? 'http://127.0.0.1:8787';
const adminPort = Number.parseInt(process.env.NEXTCLAW_PLATFORM_ADMIN_FRONTEND_PORT ?? '5177', 10);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    host: '127.0.0.1',
    port: Number.isFinite(adminPort) ? adminPort : 5177,
    strictPort: true,
    proxy: {
      '/platform': {
        target: apiBase,
        changeOrigin: true
      },
      '/v1': {
        target: apiBase,
        changeOrigin: true
      },
      '/health': {
        target: apiBase,
        changeOrigin: true
      }
    }
  }
});
