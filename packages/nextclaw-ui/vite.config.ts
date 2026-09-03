import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile } from 'node:fs/promises';
import path from 'path';

const devProxyApiBase = process.env.VITE_DEV_PROXY_API_BASE ?? 'http://127.0.0.1:18792';
const devProxyWsBase = devProxyApiBase.replace(/^http/i, 'ws');
const marketplacePreviewCovers = new Map([
  ['hello-notes', path.resolve(__dirname, '../../apps/examples/hello-notes/marketplace-assets/cover.webp')],
  ['personal-organizer', path.resolve(__dirname, '../nextclaw/resources/apps/nextclaw-personal-organizer/marketplace-assets/cover.webp')],
  ['starter-card', path.resolve(__dirname, '../../apps/examples/starter-card/marketplace-assets/cover.webp')],
  ['workspace-glance', path.resolve(__dirname, '../../apps/examples/workspace-glance/marketplace-assets/cover.webp')],
]);
const standalonePanelAppPath = /^\/apps\/panel\/[^/]+\/standalone\/?(?:\?.*)?$/;

class StandalonePanelAppRequestRewriter {
  rewrite = (request: { url?: string }) => {
    if (request.url && standalonePanelAppPath.test(request.url)) {
      request.url = '/panel-standalone.html';
    }
  };
}

const standalonePanelAppRequestRewriter = new StandalonePanelAppRequestRewriter();

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'nextclaw-panel-app-standalone-entry',
      configureServer: (server) => {
        server.middlewares.use((request, _response, next) => {
          standalonePanelAppRequestRewriter.rewrite(request);
          next();
        });
      },
      configurePreviewServer: (server) => {
        server.middlewares.use((request, _response, next) => {
          standalonePanelAppRequestRewriter.rewrite(request);
          next();
        });
      },
    },
    {
      name: 'nextclaw-app-marketplace-preview-assets',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use('/__app-marketplace-preview', async (request, response, next) => {
          const slug = request.url?.replace(/^\//, '').replace(/\.webp(?:\?.*)?$/, '');
          const coverPath = slug ? marketplacePreviewCovers.get(slug) : undefined;
          if (!coverPath) {
            next();
            return;
          }
          try {
            response.statusCode = 200;
            response.setHeader('Content-Type', 'image/webp');
            response.setHeader('Cache-Control', 'no-store');
            response.end(await readFile(coverPath));
          } catch (error) {
            next(error);
          }
        });
      },
    },
  ],
  resolve: {
    alias: {
      '@/components/auth/login-page': path.resolve(__dirname, './src/features/account/components/login-page.tsx'),
      '@/components/chat/chat-page': path.resolve(__dirname, './src/features/chat/pages/chat-page.tsx'),
      '@/components/config/ChannelsList': path.resolve(__dirname, './src/features/channels/pages/channels-list-page.tsx'),
      '@/components/config/desktop-update-config': path.resolve(__dirname, './src/features/system-status/components/desktop-update-config.tsx'),
      '@/components/config/RuntimeConfig': path.resolve(__dirname, './src/features/system-status/pages/runtime-config-page.tsx'),
      '@/components/config/security-config': path.resolve(__dirname, './src/features/system-status/components/security-config.tsx'),
      '@/components/layout/AppLayout': path.resolve(__dirname, './src/app/components/layout/app-layout.tsx'),
      '@/components/marketplace/marketplace-page': path.resolve(__dirname, './src/features/marketplace/components/marketplace-page.tsx'),
      '@/components/marketplace/mcp/mcp-marketplace-page': path.resolve(__dirname, './src/features/marketplace/components/mcp/mcp-marketplace-page.tsx'),
      '@/components/providers/I18nProvider': path.resolve(__dirname, './src/app/components/i18n-provider.tsx'),
      '@/components/providers/ThemeProvider': path.resolve(__dirname, './src/app/components/theme-provider.tsx'),
      '@/hooks/use-auth': path.resolve(__dirname, './src/features/account/hooks/use-auth.ts'),
      '@/hooks/use-app-event-consumers': path.resolve(__dirname, './src/app/hooks/use-app-event-consumers.ts'),
      '@/pwa/components/pwa-install-entry': path.resolve(__dirname, './src/features/pwa/components/pwa-install-entry.tsx'),
      '@/pwa/register-pwa': path.resolve(__dirname, './src/features/pwa/managers/pwa-bootstrap.manager.ts'),
      '@': path.resolve(__dirname, './src'),
      '@nextclaw/agent-chat': path.resolve(__dirname, '../nextclaw-agent-chat/src/index.ts'),
      '@nextclaw/agent-chat-ui': path.resolve(__dirname, '../nextclaw-agent-chat-ui/src/index.ts'),
      '@agent-chat-ui': path.resolve(__dirname, '../nextclaw-agent-chat-ui/src'),
      '@nextclaw/client-sdk': path.resolve(__dirname, '../nextclaw-client-sdk/src/index.ts'),
      '@nextclaw/ncp': path.resolve(__dirname, '../ncp-packages/nextclaw-ncp/src/index.ts'),
      '@nextclaw/ncp-http-agent-client': path.resolve(__dirname, '../ncp-packages/nextclaw-ncp-http-agent-client/src/index.ts'),
      '@nextclaw/ncp-react': path.resolve(__dirname, '../ncp-packages/nextclaw-ncp-react/src/index.ts'),
      '@nextclaw/ncp-toolkit': path.resolve(__dirname, '../ncp-packages/nextclaw-ncp-toolkit/src/index.ts'),
      '@nextclaw/shared': path.resolve(__dirname, '../nextclaw-shared/src/index.ts')
    }
  },
  server: {
    host: '127.0.0.1',
    port: 5174,
    cors: {
      credentials: true,
      origin: [
        /^http:\/\/localhost:\d+$/,
        /^http:\/\/127\.0\.0\.1:\d+$/,
        'null',
      ],
    },
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
  },
  build: {
    manifest: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        panelStandalone: path.resolve(__dirname, 'panel-standalone.html'),
      },
    },
  },
});
