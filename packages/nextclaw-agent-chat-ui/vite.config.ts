import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@agent-chat-ui': path.resolve(__dirname, './src')
    }
  },
  test: {
    environment: 'jsdom',
    globals: true
  }
});
