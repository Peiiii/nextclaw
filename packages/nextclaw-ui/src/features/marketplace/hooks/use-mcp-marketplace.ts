import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  doctorMcpMarketplaceItem,
  fetchMcpMarketplaceContent,
  fetchMcpMarketplaceInstalled,
  fetchMcpMarketplaceItem,
  fetchMcpMarketplaceItems,
  fetchMcpMarketplaceRecommendations,
  installMcpMarketplaceItem,
  manageMcpMarketplaceItem,
  type McpMarketplaceListParams
} from '@/api/mcp-marketplace';
import { t } from '@/lib/i18n';
import { collapseMarketplaceListPages } from '../utils/marketplace-list-pages.utils';
import { useMemo } from 'react';

export function useMcpMarketplaceItems(params: McpMarketplaceListParams) {
  const query = useInfiniteQuery({
    queryKey: ['marketplace-mcp-items', params],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchMcpMarketplaceItems({ ...params, page: pageParam }),
    getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined),
    staleTime: 15_000
  });

  const data = useMemo(() => collapseMarketplaceListPages(query.data), [query.data]);

  return {
    ...query,
    data
  };
}

export function useMcpMarketplaceInstalled() {
  return useQuery({
    queryKey: ['marketplace-mcp-installed'],
    queryFn: () => fetchMcpMarketplaceInstalled(),
    staleTime: 10_000
  });
}

export function useMcpMarketplaceItem(slug: string | null) {
  return useQuery({
    queryKey: ['marketplace-mcp-item', slug],
    queryFn: () => fetchMcpMarketplaceItem(slug as string),
    enabled: Boolean(slug),
    staleTime: 30_000
  });
}

export function useMcpMarketplaceContent(slug: string | null) {
  return useQuery({
    queryKey: ['marketplace-mcp-content', slug],
    queryFn: () => fetchMcpMarketplaceContent(slug as string),
    enabled: Boolean(slug),
    staleTime: 30_000
  });
}

export function useMcpMarketplaceRecommendations(params: { scene?: string; limit?: number }) {
  return useQuery({
    queryKey: ['marketplace-mcp-recommendations', params],
    queryFn: () => fetchMcpMarketplaceRecommendations(params),
    staleTime: 30_000
  });
}

export function useInstallMcpMarketplaceItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: installMcpMarketplaceItem,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-mcp-installed'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-mcp-items'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-mcp-doctor'] });
      toast.success(result.message || t('marketplaceInstallSuccessMcp'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('marketplaceInstallFailed'));
    }
  });
}

export function useManageMcpMarketplaceItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: manageMcpMarketplaceItem,
    onSuccess: (result: { message?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-mcp-installed'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-mcp-items'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-mcp-doctor'] });
      toast.success(result.message || t('marketplaceMcpManageSuccess'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('marketplaceOperationFailed'));
    }
  });
}

export function useDoctorMcpMarketplaceItem(name: string | null) {
  return useQuery({
    queryKey: ['marketplace-mcp-doctor', name],
    queryFn: () => doctorMcpMarketplaceItem(name as string),
    enabled: Boolean(name),
    staleTime: 15_000
  });
}

export { fetchMcpMarketplaceContent };
