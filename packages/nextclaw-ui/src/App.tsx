import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Toaster } from 'sonner';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true
    }
  }
});

const ModelConfigPage = lazy(async () => ({ default: (await import('@/components/config/ModelConfig')).ModelConfig }));
const ChatPage = lazy(async () => ({ default: (await import('@/components/chat/ChatPage')).ChatPage }));
const ProvidersListPage = lazy(async () => ({ default: (await import('@/components/config/ProvidersList')).ProvidersList }));
const ChannelsListPage = lazy(async () => ({ default: (await import('@/components/config/ChannelsList')).ChannelsList }));
const RuntimeConfigPage = lazy(async () => ({ default: (await import('@/components/config/RuntimeConfig')).RuntimeConfig }));
const SessionsConfigPage = lazy(async () => ({ default: (await import('@/components/config/SessionsConfig')).SessionsConfig }));
const CronConfigPage = lazy(async () => ({ default: (await import('@/components/config/CronConfig')).CronConfig }));
const SecretsConfigPage = lazy(async () => ({ default: (await import('@/components/config/SecretsConfig')).SecretsConfig }));
const MarketplacePage = lazy(async () => ({ default: (await import('@/components/marketplace/MarketplacePage')).MarketplacePage }));

function RouteFallback() {
  return <div className="h-full w-full animate-pulse rounded-2xl border border-border/40 bg-card/40" />;
}

function LazyRoute({ children }: { children: JSX.Element }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

function AppContent() {
  useWebSocket(queryClient); // Initialize WebSocket connection
  const location = useLocation();

  return (
    <QueryClientProvider client={queryClient}>
      <AppLayout>
        <div key={location.pathname} className="animate-fade-in w-full h-full">
          <Routes>
            <Route path="/chat" element={<LazyRoute><ChatPage /></LazyRoute>} />
            <Route path="/model" element={<LazyRoute><ModelConfigPage /></LazyRoute>} />
            <Route path="/providers" element={<LazyRoute><ProvidersListPage /></LazyRoute>} />
            <Route path="/channels" element={<LazyRoute><ChannelsListPage /></LazyRoute>} />
            <Route path="/runtime" element={<LazyRoute><RuntimeConfigPage /></LazyRoute>} />
            <Route path="/sessions" element={<LazyRoute><SessionsConfigPage /></LazyRoute>} />
            <Route path="/cron" element={<LazyRoute><CronConfigPage /></LazyRoute>} />
            <Route path="/secrets" element={<LazyRoute><SecretsConfigPage /></LazyRoute>} />
            <Route path="/marketplace" element={<Navigate to="/marketplace/plugins" replace />} />
            <Route path="/marketplace/:type" element={<LazyRoute><MarketplacePage /></LazyRoute>} />
            <Route path="/" element={<Navigate to="/chat" replace />} />
            <Route path="*" element={<Navigate to="/chat" replace />} />
          </Routes>
        </div>
      </AppLayout>
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}

export default AppContent;
