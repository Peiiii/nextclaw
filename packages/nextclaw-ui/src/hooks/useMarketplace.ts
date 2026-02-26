import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { t } from '@/lib/i18n';
import {
  fetchMarketplaceItem,
  fetchMarketplaceInstalled,
  fetchMarketplaceItems,
  fetchMarketplaceRecommendations,
  installMarketplaceItem,
  manageMarketplaceItem,
  type MarketplaceListParams
} from '@/api/marketplace';
import type { MarketplaceInstallRequest, MarketplaceItemType, MarketplaceManageRequest } from '@/api/types';

export function useMarketplaceItems(params: MarketplaceListParams) {
  return useQuery({
    queryKey: ['marketplace-items', params],
    queryFn: () => fetchMarketplaceItems(params),
    staleTime: 15_000
  });
}

export function useMarketplaceRecommendations(type: MarketplaceItemType, params: { scene?: string; limit?: number }) {
  return useQuery({
    queryKey: ['marketplace-recommendations', type, params],
    queryFn: () => fetchMarketplaceRecommendations(type, params),
    staleTime: 30_000
  });
}

export function useMarketplaceItem(slug: string | null, type?: MarketplaceItemType) {
  return useQuery({
    queryKey: ['marketplace-item', slug, type],
    queryFn: () => fetchMarketplaceItem(slug as string, type as MarketplaceItemType),
    enabled: Boolean(slug && type),
    staleTime: 30_000
  });
}

export function useMarketplaceInstalled(type: MarketplaceItemType) {
  return useQuery({
    queryKey: ['marketplace-installed', type],
    queryFn: () => fetchMarketplaceInstalled(type),
    staleTime: 10_000
  });
}

export function useInstallMarketplaceItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: MarketplaceInstallRequest) => installMarketplaceItem(request),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-installed', result.type] });
      queryClient.refetchQueries({ queryKey: ['marketplace-installed', result.type], type: 'active' });
      queryClient.refetchQueries({ queryKey: ['marketplace-items'], type: 'active' });
      const fallback = result.type === 'plugin'
        ? t('marketplaceInstallSuccessPlugin')
        : t('marketplaceInstallSuccessSkill');
      toast.success(result.message || fallback);
    },
    onError: (error: Error) => {
      toast.error(error.message || t('marketplaceInstallFailed'));
    }
  });
}

export function useManageMarketplaceItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: MarketplaceManageRequest) => manageMarketplaceItem(request),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-installed', result.type] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-items'] });
      queryClient.refetchQueries({ queryKey: ['marketplace-installed', result.type], type: 'active' });
      queryClient.refetchQueries({ queryKey: ['marketplace-items'], type: 'active' });
      const fallback = result.action === 'enable'
        ? t('marketplaceEnableSuccess')
        : result.action === 'disable'
          ? t('marketplaceDisableSuccess')
          : t('marketplaceUninstallSuccess');
      toast.success(result.message || fallback);
    },
    onError: (error: Error) => {
      toast.error(error.message || t('marketplaceOperationFailed'));
    }
  });
}
