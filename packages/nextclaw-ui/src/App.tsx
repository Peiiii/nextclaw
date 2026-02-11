import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useUiStore } from '@/stores/ui.store';
import { AppLayout } from '@/components/layout/AppLayout';
import { ModelConfig } from '@/components/config/ModelConfig';
import { ProvidersList } from '@/components/config/ProvidersList';
import { ChannelsList } from '@/components/config/ChannelsList';
import { UiConfig } from '@/components/config/UiConfig';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Toaster } from 'sonner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true
    }
  }
});

function AppContent() {
  const { activeTab } = useUiStore();
  useWebSocket(queryClient); // Initialize WebSocket connection

  const renderContent = () => {
    switch (activeTab) {
      case 'model':
        return <ModelConfig />;
      case 'providers':
        return <ProvidersList />;
      case 'channels':
        return <ChannelsList />;
      case 'ui':
        return <UiConfig />;
      default:
        return <ModelConfig />;
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <AppLayout>
        {renderContent()}
      </AppLayout>
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}

export default AppContent;
