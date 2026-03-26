import { lazy, Suspense, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { DocBrowserProvider, useDocBrowser } from '@/components/doc-browser/DocBrowserContext';
import { useDocLinkInterceptor } from '@/components/doc-browser/useDocLinkInterceptor';
import { useI18n } from '@/components/providers/I18nProvider';
import { resolveUiDocumentTitle } from '@/lib/ui-document-title';
import { cn } from '@/lib/utils';

const DocBrowser = lazy(async () => ({ default: (await import('@/components/doc-browser/DocBrowser')).DocBrowser }));

interface AppLayoutProps {
  children: React.ReactNode;
}

function isMainWorkspaceRoute(pathname: string): boolean {
  const normalized = pathname.toLowerCase();
  return (
    normalized === '/chat' ||
    normalized.startsWith('/chat/') ||
    normalized === '/skills' ||
    normalized.startsWith('/skills/') ||
    normalized === '/cron' ||
    normalized.startsWith('/cron/')
  );
}

function isChannelsRoute(pathname: string): boolean {
  const normalized = pathname.toLowerCase();
  return normalized === '/channels' || normalized.startsWith('/channels/');
}

function AppLayoutInner({ children }: AppLayoutProps) {
  const { isOpen, mode } = useDocBrowser();
  useDocLinkInterceptor();
  const { pathname } = useLocation();
  const { language } = useI18n();
  const isMainRoute = isMainWorkspaceRoute(pathname);
  const lockPageScroll = isChannelsRoute(pathname);

  useEffect(() => {
    document.title = resolveUiDocumentTitle(pathname);
  }, [pathname, language]);

  return (
    <div className="h-screen flex bg-background font-sans text-foreground">
      {!isMainRoute && <Sidebar mode="settings" />}
      <div className="flex-1 flex min-w-0 overflow-hidden relative">
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {isMainRoute ? (
            <div className="flex-1 h-full overflow-hidden">{children}</div>
          ) : (
            <main
              className={cn(
                'flex-1 custom-scrollbar p-8',
                lockPageScroll ? 'overflow-auto xl:overflow-hidden' : 'overflow-auto'
              )}
            >
              <div
                className={cn(
                  'max-w-6xl mx-auto animate-fade-in h-full',
                  lockPageScroll && 'min-h-0 xl:overflow-hidden'
                )}
              >
                {children}
              </div>
            </main>
          )}
        </div>
        {/* Doc Browser: docked mode renders inline, floating mode renders as overlay */}
        {isOpen && mode === 'docked' && (
          <Suspense fallback={null}>
            <DocBrowser />
          </Suspense>
        )}
      </div>
      {isOpen && mode === 'floating' && (
        <Suspense fallback={null}>
          <DocBrowser />
        </Suspense>
      )}
    </div>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <DocBrowserProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </DocBrowserProvider>
  );
}
