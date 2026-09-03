import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { appQueryClient } from '@/app-query-client';
import { I18nProvider } from '@/app/components/i18n-provider';
import { ThemeProvider } from '@/app/components/theme-provider';
import { PanelAppStandalonePage } from '@/features/panel-apps/pages/panel-app-standalone-page';
import { PanelAppHostProvider } from '@/features/panel-apps/providers/panel-app-host.provider';
import { PanelAppServiceActionAuthorizationDialog } from '@/features/panel-apps/components/panel-app-service-action-authorization-dialog';
import { installPanelAppI18nCatalog, t } from '@/shared/lib/i18n';
import { isTransientAuthStatusBootstrapError, useAuthStatus } from '@/shared/hooks/use-auth-status';
import '@/app/styles/panel-app-standalone.css';

const LoginPage = lazy(async () => ({
  default: (await import('@/features/account/components/login-page')).LoginPage,
}));

const PANEL_APP_STANDALONE_PATH = /^\/apps\/panel\/([^/]+)\/standalone\/?$/;

export function readStandalonePanelAppId(pathname: string): string | null {
  const match = PANEL_APP_STANDALONE_PATH.exec(pathname);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function StandaloneAuthGate({ appId }: { appId: string }) {
  const authStatus = useAuthStatus();
  const isTransientBootstrapFailure =
    authStatus.isError && isTransientAuthStatusBootstrapError(authStatus.error);

  if (
    (authStatus.isLoading && !authStatus.isError) ||
    isTransientBootstrapFailure ||
    authStatus.isError
  ) {
    return <PanelAppStandalonePage appId={appId} />;
  }

  if (authStatus.data?.enabled && !authStatus.data.authenticated) {
    return (
      <Suspense fallback={<StandaloneStatus message={t('loading')} />}>
        <LoginPage username={authStatus.data.username} />
      </Suspense>
    );
  }

  return <PanelAppStandalonePage appId={appId} />;
}

function StandaloneStatus({ message }: { message: string }) {
  return (
    <main className="flex h-dvh items-center justify-center bg-background px-6 text-sm text-muted-foreground">
      {message}
    </main>
  );
}

export function PanelAppStandaloneRoute({ pathname = window.location.pathname }: { pathname?: string }) {
  const appId = readStandalonePanelAppId(pathname);

  if (!appId) {
    return <StandaloneStatus message={t('panelAppsMainUnavailable')} />;
  }

  return (
    <QueryClientProvider client={appQueryClient}>
      <PanelAppHostProvider>
        <StandaloneAuthGate appId={appId} />
        <PanelAppServiceActionAuthorizationDialog />
        <Toaster position="top-right" richColors offset={16} />
      </PanelAppHostProvider>
    </QueryClientProvider>
  );
}

await installPanelAppI18nCatalog();

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ThemeProvider>
        <I18nProvider>
          <PanelAppStandaloneRoute />
        </I18nProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}
