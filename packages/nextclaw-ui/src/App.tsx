import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { ModelConfig } from '@/components/config/ModelConfig';
import { ProvidersList } from '@/components/config/ProvidersList';
import { ChannelsList } from '@/components/config/ChannelsList';
import { RuntimeConfig } from '@/components/config/RuntimeConfig';
import { SessionsConfig } from '@/components/config/SessionsConfig';
import { CronConfig } from '@/components/config/CronConfig';
import { MarketplacePage } from '@/components/marketplace/MarketplacePage';
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

function AppContent() {
  useWebSocket(queryClient); // Initialize WebSocket connection
  const location = useLocation();

  return (
    <QueryClientProvider client={queryClient}>
      <AppLayout>
        <div key={location.pathname} className="animate-fade-in w-full h-full">
          <Routes>
            <Route path="/model" element={<ModelConfig />} />
            <Route path="/providers" element={<ProvidersList />} />
            <Route path="/channels" element={<ChannelsList />} />
            <Route path="/runtime" element={<RuntimeConfig />} />
            <Route path="/sessions" element={<SessionsConfig />} />
            <Route path="/cron" element={<CronConfig />} />
            <Route path="/marketplace" element={<MarketplacePage />} />
            <Route path="/" element={<Navigate to="/model" replace />} />
            <Route path="*" element={<Navigate to="/model" replace />} />
          </Routes>
        </div>
      </AppLayout>
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}

export default AppContent;
