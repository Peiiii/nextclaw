import type { RemoteInstanceStatus, RemoteInstanceView } from "@/types/platform";

export type RemoteInstanceArchiveStatus = "active" | "archived" | "all";
export type RemoteInstanceConnectionStatus = RemoteInstanceStatus | "all";
export type RemoteInstanceSortBy = "lastSeenAt" | "displayName" | "createdAt";
export type RemoteInstanceSortDirection = "asc" | "desc";

export type RemoteInstanceListQuery = {
  archiveStatus: RemoteInstanceArchiveStatus;
  connectionStatus: RemoteInstanceConnectionStatus;
  q: string;
  page: number;
  pageSize: number;
  sortBy: RemoteInstanceSortBy;
  sortDirection: RemoteInstanceSortDirection;
};

export type RemoteInstanceListView = RemoteInstanceListQuery & {
  total: number;
  totalPages: number;
  items: RemoteInstanceView[];
};
