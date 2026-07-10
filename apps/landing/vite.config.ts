import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
    server: {
        port: 5175,
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
        },
    },
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                root: resolve(__dirname, 'index.html'),
                en: resolve(__dirname, 'en/index.html'),
                zh: resolve(__dirname, 'zh/index.html'),
                enDownload: resolve(__dirname, 'en/download/index.html'),
                zhDownload: resolve(__dirname, 'zh/download/index.html'),
                enInstall: resolve(__dirname, 'en/install/index.html'),
                zhInstall: resolve(__dirname, 'zh/install/index.html'),
                enUseCases: resolve(__dirname, 'en/use-cases/index.html'),
                zhUseCases: resolve(__dirname, 'zh/use-cases/index.html'),
                enIntegrations: resolve(__dirname, 'en/integrations/index.html'),
                zhIntegrations: resolve(__dirname, 'zh/integrations/index.html'),
                enReleases: resolve(__dirname, 'en/releases/index.html'),
                zhReleases: resolve(__dirname, 'zh/releases/index.html'),
            },
        },
    },
});
