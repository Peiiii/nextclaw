import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@/components/chat/ChatWelcome': path.resolve(__dirname, './src/features/chat/components/chat-welcome.tsx'),
      '@/components/chat/chat-conversation-panel': path.resolve(__dirname, './src/features/chat/components/conversation/chat-conversation-panel.tsx'),
      '@/components/chat/chat-page': path.resolve(__dirname, './src/features/chat/pages/chat-page.tsx'),
      '@/components/chat/chat-page-shell': path.resolve(__dirname, './src/features/chat/components/layout/chat-page-shell.tsx'),
      '@/components/chat/ncp/ncp-chat.presenter': path.resolve(__dirname, './src/features/chat/managers/ncp-chat-presenter.manager.ts'), '@/components/chat/ncp/ncp-chat-input.manager': path.resolve(__dirname, './src/features/chat/managers/ncp-chat-input.manager.ts'), '@/components/chat/ncp/ncp-chat-thread.manager': path.resolve(__dirname, './src/features/chat/managers/ncp-chat-thread.manager.ts'), '@/components/chat/ncp/ncp-session-adapter': path.resolve(__dirname, './src/features/chat/utils/ncp-session-adapter.utils.ts'), '@/components/chat/ncp/use-ncp-session-list-view': path.resolve(__dirname, './src/features/chat/hooks/use-ncp-session-list-view.ts'),
      '@/components/config/desktop-update-config': path.resolve(__dirname, './src/features/system-status/components/desktop-update-config.tsx'),
      '@/components/chat/useChatSessionTypeState': path.resolve(__dirname, './src/features/chat/hooks/use-chat-session-type-state.ts'),
      '@': path.resolve(__dirname, './src'),
      '@nextclaw/agent-chat': path.resolve(__dirname, '../nextclaw-agent-chat/src/index.ts')
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts']
  }
});
