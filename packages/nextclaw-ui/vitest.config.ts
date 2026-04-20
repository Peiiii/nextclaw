import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@/components/chat/ChatWelcome': path.resolve(__dirname, './src/features/chat/components/chat-welcome.tsx'),
      '@/components/chat/chat-conversation-panel': path.resolve(__dirname, './src/features/chat/components/conversation/chat-conversation-panel.tsx'),
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
