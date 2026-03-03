import { lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { DocBrowserProvider, useDocBrowser } from '@/components/doc-browser/DocBrowserContext';
import { useDocLinkInterceptor } from '@/components/doc-browser/useDocLinkInterceptor';
import { cn } from '@/lib/utils';

const DocBrowser = lazy(async () => ({ default: (await import('@/components/doc-browser/DocBrowser')).DocBrowser }));

interface AppLayoutProps {
  children: React.ReactNode;
}

function AppLayoutInner({ children }: AppLayoutProps) {
  const { isOpen, mode } = useDocBrowser();
  useDocLinkInterceptor();
  const { pathname } = useLocation();
  const isChatRoute = pathname === '/chat' || pathname.startsWith('/chat/');

  return (
    <div className="h-screen flex bg-background font-sans text-foreground">
      {!isChatRoute && <Sidebar />}
      <div className="flex-1 flex min-w-0 overflow-hidden relative">
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {isChatRoute ? (
            <div className="flex-1 h-full overflow-hidden">{children}</div>
          ) : (
            <main className="flex-1 overflow-auto custom-scrollbar p-8">
              <div className="max-w-6xl mx-auto animate-fade-in h-full">
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
