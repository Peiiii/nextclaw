import { QueryClient } from '@tanstack/react-query';

export const appQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true
    }
  }
});
