import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import App from './app';
import { I18nProvider } from '@/components/providers/I18nProvider';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { installMainI18nCatalog } from '@/shared/lib/i18n';
import './index.css';

await installMainI18nCatalog();

const AppRouter = window.nextclawDesktop?.platform === 'win32' ? MemoryRouter : BrowserRouter;
const root = createRoot(document.getElementById('root')!);

if (import.meta.env.DEV && window.location.pathname === '/__debug/chat-tool-call-stress') {
  void import('@/features/chat/features/message/components/chat-tool-call-stress-harness').then(
    ({ ChatToolCallStressHarness }) => {
      root.render(
        <StrictMode>
          <ChatToolCallStressHarness />
        </StrictMode>,
      );
    },
  );
} else {
  root.render(
    <StrictMode>
      <ThemeProvider>
        <I18nProvider>
          <AppRouter>
            <App />
          </AppRouter>
        </I18nProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}
