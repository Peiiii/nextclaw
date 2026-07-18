import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchRemoteInstancePage } from '@/features/dashboard/utils/remote-instance-api.utils';
import type {
  RemoteInstanceArchiveStatus,
  RemoteInstanceConnectionStatus,
  RemoteInstanceListQuery,
  RemoteInstanceSortBy,
  RemoteInstanceSortDirection
} from '@/features/dashboard/types/remote-instance.types';

const DEFAULT_LIST_QUERY: RemoteInstanceListQuery = {
  archiveStatus: 'active',
  connectionStatus: 'all',
  q: '',
  page: 1,
  pageSize: 10,
  sortBy: 'lastSeenAt',
  sortDirection: 'desc'
};

export function useRemoteInstanceList({ token }: { token: string }) {
  const [listQuery, setListQuery] = useState<RemoteInstanceListQuery>(DEFAULT_LIST_QUERY);
  const [searchInput, setSearchInput] = useState('');
  const query = useQuery({
    queryKey: ['remote-instances', listQuery],
    queryFn: async () => await fetchRemoteInstancePage(token, listQuery),
    placeholderData: (previousData) => previousData
  });

  function applySearch(): void {
    setListQuery((current) => ({ ...current, q: searchInput.trim(), page: 1 }));
  }

  function resetFilters(): void {
    setSearchInput('');
    setListQuery(DEFAULT_LIST_QUERY);
  }

  function setArchiveStatus(archiveStatus: RemoteInstanceArchiveStatus): void {
    setListQuery((current) => ({ ...current, archiveStatus, page: 1 }));
  }

  function setConnectionStatus(connectionStatus: RemoteInstanceConnectionStatus): void {
    setListQuery((current) => ({ ...current, connectionStatus, page: 1 }));
  }

  function setSorting(sortBy: RemoteInstanceSortBy, sortDirection: RemoteInstanceSortDirection): void {
    setListQuery((current) => ({ ...current, sortBy, sortDirection, page: 1 }));
  }

  function setPage(page: number): void {
    setListQuery((current) => ({ ...current, page }));
  }

  function setPageSize(pageSize: number): void {
    setListQuery((current) => ({ ...current, pageSize, page: 1 }));
  }

  function resetPage(): void {
    setListQuery((current) => ({ ...current, page: 1 }));
  }

  return {
    applySearch,
    listQuery,
    query,
    resetFilters,
    resetPage,
    searchInput,
    setArchiveStatus,
    setConnectionStatus,
    setPage,
    setPageSize,
    setSearchInput,
    setSorting
  };
}
