import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@/components/auth/login-page': path.resolve(__dirname, './src/features/account/components/login-page.tsx'),
      '@/components/chat/chat-page': path.resolve(__dirname, './src/features/chat/pages/chat-page.tsx'),
      '@/components/config/ChannelsList': path.resolve(__dirname, './src/features/channels/pages/channels-list-page.tsx'),
      '@/components/config/desktop-update-config': path.resolve(__dirname, './src/features/system-status/components/desktop-update-config.tsx'),
      '@/components/config/ModelConfig': path.resolve(__dirname, './src/shared/components/model-config.tsx'),
      '@/components/config/ProvidersList': path.resolve(__dirname, './src/shared/components/config/providers-list.tsx'),
      '@/components/config/RuntimeConfig': path.resolve(__dirname, './src/features/system-status/pages/runtime-config-page.tsx'),
      '@/components/config/SearchConfig': path.resolve(__dirname, './src/shared/components/search-config.tsx'),
      '@/components/config/SecretsConfig': path.resolve(__dirname, './src/shared/components/config/secrets-config.tsx'),
      '@/components/config/security-config': path.resolve(__dirname, './src/features/system-status/components/security-config.tsx'),
      '@/components/config/SessionsConfig': path.resolve(__dirname, './src/features/chat/pages/sessions-config-page.tsx'),
      '@/components/layout/AppLayout': path.resolve(__dirname, './src/app/components/layout/app-layout.tsx'),
      '@/components/marketplace/marketplace-page': path.resolve(__dirname, './src/features/marketplace/components/marketplace-page.tsx'),
      '@/components/marketplace/mcp/mcp-marketplace-page': path.resolve(__dirname, './src/features/marketplace/components/mcp/mcp-marketplace-page.tsx'),
      '@/components/providers/I18nProvider': path.resolve(__dirname, './src/app/components/i18n-provider.tsx'),
      '@/components/providers/ThemeProvider': path.resolve(__dirname, './src/app/components/theme-provider.tsx'),
      '@/hooks/use-auth': path.resolve(__dirname, './src/features/account/hooks/use-auth.ts'),
      '@/hooks/use-realtime-query-bridge': path.resolve(__dirname, './src/app/hooks/use-realtime-query-bridge.ts'),
      '@/pwa/components/pwa-install-entry': path.resolve(__dirname, './src/features/pwa/components/pwa-install-entry.tsx'),
      '@/pwa/register-pwa': path.resolve(__dirname, './src/features/pwa/managers/pwa-bootstrap.manager.ts'),
      '@': path.resolve(__dirname, './src'),
      '@nextclaw/agent-chat': path.resolve(__dirname, '../nextclaw-agent-chat/src/index.ts')
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/app/test/vitest-setup.ts']
  }
});
