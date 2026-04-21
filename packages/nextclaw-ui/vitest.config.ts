import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@/components/chat/containers/chat-input-bar.container': path.resolve(__dirname, './src/features/chat/components/conversation/chat-input-bar.container.tsx'), '@/components/chat/containers/chat-message-list.container': path.resolve(__dirname, './src/features/chat/components/conversation/chat-message-list.container.tsx'),
      '@/components/chat/chat-stream/types': path.resolve(__dirname, './src/features/chat/types/chat-stream.types.ts'), '@/components/chat/managers/chat-stream-actions.manager': path.resolve(__dirname, './src/features/chat/managers/chat-stream-actions.manager.ts'), '@/components/chat/managers/chat-ui.manager': path.resolve(__dirname, './src/features/chat/managers/chat-ui.manager.ts'), '@/components/chat/presenter/chat-presenter-context': path.resolve(__dirname, './src/features/chat/components/providers/chat-presenter.provider.tsx'), '@/components/chat/stores/chat-input.store': path.resolve(__dirname, './src/features/chat/stores/chat-input.store.ts'), '@/components/chat/stores/chat-thread.store': path.resolve(__dirname, './src/features/chat/stores/chat-thread.store.ts'),
      '@/components/config/ModelConfig': path.resolve(__dirname, './src/shared/components/model-config.tsx'),
      '@/components/config/SecretsConfig': path.resolve(__dirname, './src/shared/components/config/secrets-config.tsx'),
      '@/components/config/SearchConfig': path.resolve(__dirname, './src/shared/components/search-config.tsx'),
      '@/components/config/ProvidersList': path.resolve(__dirname, './src/shared/components/config/providers-list.tsx'),
      '@/components/config/security-config': path.resolve(__dirname, './src/features/system-status/components/security-config.tsx'),
      '@/components/config/SessionsConfig': path.resolve(__dirname, './src/features/chat/pages/sessions-config-page.tsx'),
      '@/components/config/RuntimeConfig': path.resolve(__dirname, './src/features/system-status/pages/runtime-config-page.tsx'),
      '@/components/config/ChannelsList': path.resolve(__dirname, './src/features/channels/pages/channels-list-page.tsx'),
      '@/components/config/ChannelForm': path.resolve(__dirname, './src/features/channels/components/config/channel-form.tsx'),
      '@/components/config/weixin-channel-auth-section': path.resolve(__dirname, './src/features/channels/components/config/weixin-channel-auth-section.tsx'),
      '@/components/chat/chat-page': path.resolve(__dirname, './src/features/chat/pages/chat-page.tsx'),
      '@/components/chat/adapters/chat-input-bar.adapter': path.resolve(__dirname, './src/features/chat/utils/chat-input-bar.utils.ts'),
      '@/components/chat/adapters/chat-message.adapter': path.resolve(__dirname, './src/features/chat/utils/chat-message.utils.ts'),
      '@/components/chat/managers/chat-session-list.manager': path.resolve(__dirname, './src/features/chat/managers/chat-session-list.manager.ts'), '@/components/chat/hooks/use-chat-session-update': path.resolve(__dirname, './src/features/chat/hooks/use-chat-session-update.ts'), '@/components/chat/hooks/use-chat-session-label': path.resolve(__dirname, './src/features/chat/hooks/use-chat-session-label.ts'), '@/components/chat/hooks/use-chat-session-project': path.resolve(__dirname, './src/features/chat/hooks/use-chat-session-project.ts'), '@/components/chat/hooks/use-chat-sidebar-session-label-editor': path.resolve(__dirname, './src/features/chat/hooks/use-chat-sidebar-session-label-editor.ts'),
      '@/components/chat/ncp/ncp-chat.presenter': path.resolve(__dirname, './src/features/chat/managers/ncp-chat-presenter.manager.ts'), '@/components/chat/ncp/ncp-chat-input.manager': path.resolve(__dirname, './src/features/chat/managers/ncp-chat-input.manager.ts'), '@/components/chat/ncp/ncp-chat-thread.manager': path.resolve(__dirname, './src/features/chat/managers/ncp-chat-thread.manager.ts'), '@/components/chat/ncp/ncp-session-adapter': path.resolve(__dirname, './src/features/chat/utils/ncp-session-adapter.utils.ts'), '@/components/chat/ncp/use-ncp-session-list-view': path.resolve(__dirname, './src/features/chat/hooks/use-ncp-session-list-view.ts'), '@/components/chat/stores/chat-session-list.store': path.resolve(__dirname, './src/features/chat/stores/chat-session-list.store.ts'),
      '@/components/config/desktop-update-config': path.resolve(__dirname, './src/features/system-status/components/desktop-update-config.tsx'),
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
