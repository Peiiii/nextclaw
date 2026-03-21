import { lazy, Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AccountPanel } from '@/account/components/account-panel';
import { appQueryClient } from '@/app-query-client';
import { LoginPage } from '@/components/auth/login-page';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuthStatus } from '@/hooks/use-auth';
import { useWebSocket } from '@/hooks/useWebSocket';
import { AppPresenterProvider } from '@/presenter/app-presenter-context';
import { Toaster } from 'sonner';
import { Routes, Route, Navigate } from 'react-router-dom';

const ModelConfigPage = lazy(async () => ({ default: (await import('@/components/config/ModelConfig')).ModelConfig }));
const ChatPage = lazy(async () => ({ default: (await import('@/components/chat/ChatPage')).ChatPage }));
const SearchConfigPage = lazy(async () => ({ default: (await import('@/components/config/SearchConfig')).SearchConfig }));
const ProvidersListPage = lazy(async () => ({ default: (await import('@/components/config/ProvidersList')).ProvidersList }));
const ChannelsListPage = lazy(async () => ({ default: (await import('@/components/config/ChannelsList')).ChannelsList }));
const RuntimeConfigPage = lazy(async () => ({ default: (await import('@/components/config/RuntimeConfig')).RuntimeConfig }));
const SecurityConfigPage = lazy(async () => ({ default: (await import('@/components/config/security-config')).SecurityConfig }));
const SessionsConfigPage = lazy(async () => ({ default: (await import('@/components/config/SessionsConfig')).SessionsConfig }));
const SecretsConfigPage = lazy(async () => ({ default: (await import('@/components/config/SecretsConfig')).SecretsConfig }));
const RemoteAccessPage = lazy(async () => ({ default: (await import('@/components/remote/RemoteAccessPage')).RemoteAccessPage }));
const MarketplacePage = lazy(async () => ({ default: (await import('@/components/marketplace/MarketplacePage')).MarketplacePage }));
const McpMarketplacePage = lazy(async () => ({ default: (await import('@/components/marketplace/mcp/McpMarketplacePage')).McpMarketplacePage }));

function RouteFallback() {
  return <div className="h-full w-full animate-pulse rounded-2xl border border-border/40 bg-card/40" />;
}

function LazyRoute({ children }: { children: JSX.Element }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

function ProtectedApp() {
  useWebSocket(appQueryClient); // Initialize WebSocket connection

  return (
    <AppPresenterProvider>
      <AppLayout>
        <div className="w-full h-full">
          <Routes>
            <Route path="/chat/skills" element={<Navigate to="/skills" replace />} />
            <Route path="/chat/cron" element={<Navigate to="/cron" replace />} />
            <Route path="/chat/:sessionId?" element={<LazyRoute><ChatPage view="chat" /></LazyRoute>} />
            <Route path="/skills" element={<LazyRoute><ChatPage view="skills" /></LazyRoute>} />
            <Route path="/cron" element={<LazyRoute><ChatPage view="cron" /></LazyRoute>} />
            <Route path="/model" element={<LazyRoute><ModelConfigPage /></LazyRoute>} />
            <Route path="/search" element={<LazyRoute><SearchConfigPage /></LazyRoute>} />
            <Route path="/providers" element={<LazyRoute><ProvidersListPage /></LazyRoute>} />
            <Route path="/channels" element={<LazyRoute><ChannelsListPage /></LazyRoute>} />
            <Route path="/runtime" element={<LazyRoute><RuntimeConfigPage /></LazyRoute>} />
            <Route path="/remote" element={<LazyRoute><RemoteAccessPage /></LazyRoute>} />
            <Route path="/security" element={<LazyRoute><SecurityConfigPage /></LazyRoute>} />
            <Route path="/sessions" element={<LazyRoute><SessionsConfigPage /></LazyRoute>} />
            <Route path="/secrets" element={<LazyRoute><SecretsConfigPage /></LazyRoute>} />
            <Route path="/settings" element={<Navigate to="/model" replace />} />
            <Route path="/marketplace/skills" element={<Navigate to="/skills" replace />} />
            <Route path="/marketplace" element={<Navigate to="/marketplace/plugins" replace />} />
            <Route path="/marketplace/mcp" element={<LazyRoute><McpMarketplacePage /></LazyRoute>} />
            <Route path="/marketplace/:type" element={<LazyRoute><MarketplacePage /></LazyRoute>} />
            <Route path="/" element={<Navigate to="/chat" replace />} />
            <Route path="*" element={<Navigate to="/chat" replace />} />
          </Routes>
        </div>
      </AppLayout>
      <AccountPanel />
    </AppPresenterProvider>
  );
}

function AuthGate() {
  const authStatus = useAuthStatus();

  if (authStatus.isLoading && !authStatus.isError) {
    return <RouteFallback />;
  }

  if (authStatus.data?.enabled && !authStatus.data.authenticated) {
    return <LoginPage username={authStatus.data.username} />;
  }

  return <ProtectedApp />;
}

export default function AppContent() {
  return (
    <QueryClientProvider client={appQueryClient}>
      <AuthGate />
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}
