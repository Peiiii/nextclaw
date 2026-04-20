import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const devProxyApiBase = process.env.VITE_DEV_PROXY_API_BASE ?? 'http://127.0.0.1:18792';
const devProxyWsBase = devProxyApiBase.replace(/^http/i, 'ws');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@/components/chat/ChatWelcome': path.resolve(__dirname, './src/features/chat/components/chat-welcome.tsx'),
      '@/components/chat/chat-conversation-panel': path.resolve(__dirname, './src/features/chat/components/conversation/chat-conversation-panel.tsx'),
      '@/components/chat/chat-page': path.resolve(__dirname, './src/features/chat/pages/chat-page.tsx'),
      '@/components/chat/chat-page-shell': path.resolve(__dirname, './src/features/chat/components/layout/chat-page-shell.tsx'),
      '@/components/chat/useChatSessionTypeState': path.resolve(__dirname, './src/features/chat/hooks/use-chat-session-type-state.ts'),
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
