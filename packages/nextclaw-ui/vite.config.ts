import { defineConfig, splitVendorChunkPlugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const apiBase = process.env.VITE_API_BASE ?? 'http://127.0.0.1:18792';
const wsBase = apiBase.replace(/^http/i, 'ws');

export default defineConfig({
  plugins: [react(), splitVendorChunkPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@nextclaw/agent-chat': path.resolve(__dirname, '../nextclaw-agent-chat/src/index.ts')
    }
  },
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': {
        target: apiBase,
        changeOrigin: true
      },
      '/ws': {
        target: wsBase,
        ws: true
      }
    }
  }
});
