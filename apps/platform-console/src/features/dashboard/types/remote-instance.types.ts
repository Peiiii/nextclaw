import type { RemoteInstance } from '@/api/types';

export type RemoteInstanceArchiveStatus = 'active' | 'archived' | 'all';
export type RemoteInstanceConnectionStatus = RemoteInstance['status'] | 'all';
export type RemoteInstanceSortBy = 'lastSeenAt' | 'displayName' | 'createdAt';
export type RemoteInstanceSortDirection = 'asc' | 'desc';

export type RemoteInstanceListQuery = {
  archiveStatus: RemoteInstanceArchiveStatus;
  connectionStatus: RemoteInstanceConnectionStatus;
  q: string;
  page: number;
  pageSize: number;
  sortBy: RemoteInstanceSortBy;
  sortDirection: RemoteInstanceSortDirection;
};

export type RemoteInstanceListPage = RemoteInstanceListQuery & {
  total: number;
  totalPages: number;
  items: RemoteInstance[];
};
