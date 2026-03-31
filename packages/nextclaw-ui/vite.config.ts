import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const devProxyApiBase = process.env.VITE_DEV_PROXY_API_BASE ?? 'http://127.0.0.1:18792';
const devProxyWsBase = devProxyApiBase.replace(/^http/i, 'ws');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@nextclaw/agent-chat': path.resolve(__dirname, '../nextclaw-agent-chat/src/index.ts'),
      '@nextclaw/agent-chat-ui': path.resolve(__dirname, '../nextclaw-agent-chat-ui/src/index.ts')
    }
  },
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': {
        target: devProxyApiBase,
        changeOrigin: true
      },
      '/ws': {
        target: devProxyWsBase,
        ws: true
      }
    }
  }
});
