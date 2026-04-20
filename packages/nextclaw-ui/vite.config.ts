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
      '@/components/chat/chat-conversation-panel': path.resolve(__dirname, './src/features/chat/components/conversation/chat-conversation-panel.tsx'), '@/components/chat/containers/chat-input-bar.container': path.resolve(__dirname, './src/features/chat/components/conversation/chat-input-bar.container.tsx'), '@/components/chat/containers/chat-message-list.container': path.resolve(__dirname, './src/features/chat/components/conversation/chat-message-list.container.tsx'),
      '@/components/config/ModelConfig': path.resolve(__dirname, './src/shared/components/model-config.tsx'),
      '@/components/config/SecretsConfig': path.resolve(__dirname, './src/shared/components/config/secrets-config.tsx'),
      '@/components/config/SearchConfig': path.resolve(__dirname, './src/shared/components/search-config.tsx'),
      '@/components/config/SessionsConfig': path.resolve(__dirname, './src/features/chat/pages/sessions-config-page.tsx'),
      '@/components/chat/chat-page': path.resolve(__dirname, './src/features/chat/pages/chat-page.tsx'),
      '@/components/chat/chat-page-shell': path.resolve(__dirname, './src/features/chat/components/layout/chat-page-shell.tsx'), '@/components/chat/managers/chat-session-list.manager': path.resolve(__dirname, './src/features/chat/managers/chat-session-list.manager.ts'),
      '@/components/chat/ncp/ncp-chat.presenter': path.resolve(__dirname, './src/features/chat/managers/ncp-chat-presenter.manager.ts'), '@/components/chat/ncp/ncp-chat-input.manager': path.resolve(__dirname, './src/features/chat/managers/ncp-chat-input.manager.ts'), '@/components/chat/ncp/ncp-chat-thread.manager': path.resolve(__dirname, './src/features/chat/managers/ncp-chat-thread.manager.ts'), '@/components/chat/ncp/ncp-session-adapter': path.resolve(__dirname, './src/features/chat/utils/ncp-session-adapter.utils.ts'), '@/components/chat/ncp/use-ncp-session-list-view': path.resolve(__dirname, './src/features/chat/hooks/use-ncp-session-list-view.ts'), '@/components/chat/stores/chat-session-list.store': path.resolve(__dirname, './src/features/chat/stores/chat-session-list.store.ts'),
      '@/components/config/desktop-update-config': path.resolve(__dirname, './src/features/system-status/components/desktop-update-config.tsx'),
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
