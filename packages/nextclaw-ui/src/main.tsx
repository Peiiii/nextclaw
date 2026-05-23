import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import App from './app';
import { I18nProvider } from '@/components/providers/I18nProvider';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import './index.css';

const AppRouter = window.nextclawDesktop?.platform === 'win32' ? MemoryRouter : BrowserRouter;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <AppRouter>
          <App />
        </AppRouter>
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>
);
