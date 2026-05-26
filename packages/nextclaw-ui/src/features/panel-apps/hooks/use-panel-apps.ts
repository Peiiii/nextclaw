import { useQuery } from '@tanstack/react-query';
import { nextclawClient } from '@/shared/lib/api';

export function usePanelApps() {
  return useQuery({
    queryKey: ['panel-apps'],
    queryFn: () => nextclawClient.panelApps.listPanelApps(),
    staleTime: 0,
  });
}
