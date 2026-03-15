import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const apiBase = process.env.VITE_NCP_DEMO_API_BASE ?? 'http://127.0.0.1:3197';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    },
    conditions: ['development']
  },
  server: {
    host: '127.0.0.1',
    port: 5181,
    strictPort: true,
    proxy: {
      '/ncp': {
        target: apiBase,
        changeOrigin: true
      },
      '/demo': {
        target: apiBase,
        changeOrigin: true
      },
      '/health': {
        target: apiBase,
        changeOrigin: true
      }
    }
  }
});
