import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const devProxyApiBase = process.env.VITE_DEV_PROXY_API_BASE ?? 'http://127.0.0.1:18792';
const devProxyWsBase = devProxyApiBase.replace(/^http/i, 'ws');

export default defineConfig({
  plugins: [react()],
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
      '@/components/providers/I18nProvider': path.resolve(__dirname, './src/app/components/providers/i18n-provider.tsx'),
      '@/components/providers/ThemeProvider': path.resolve(__dirname, './src/app/components/providers/theme-provider.tsx'),
      '@/hooks/use-auth': path.resolve(__dirname, './src/features/account/hooks/use-auth.ts'),
      '@/hooks/use-realtime-query-bridge': path.resolve(__dirname, './src/app/hooks/use-realtime-query-bridge.ts'),
      '@/pwa/components/pwa-install-entry': path.resolve(__dirname, './src/platforms/pwa/components/pwa-install-entry.tsx'),
      '@/pwa/register-pwa': path.resolve(__dirname, './src/platforms/pwa/managers/pwa-bootstrap.manager.ts'),
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
