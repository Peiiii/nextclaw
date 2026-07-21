import type {
  RemoteAccessSession as BaseRemoteAccessSession,
  RemoteInstance as BaseRemoteInstance,
} from "@/api/types";

export type RemoteInstance = BaseRemoteInstance & {
  systemDomainPrefix: string;
  systemDomain: string | null;
  systemDomainClaimedAt: string;
  customDomainPrefix: string | null;
  customDomain: string | null;
  customDomainClaimedAt: string | null;
  customDomainExpiresAt: string | null;
};

export type RemoteInstanceOpenSession = BaseRemoteAccessSession & {
  systemDomainOpenUrl: string | null;
  customDomainOpenUrl: string | null;
};

export type RemoteInstanceArchiveStatus = "active" | "archived" | "all";
export type RemoteInstanceConnectionStatus = RemoteInstance["status"] | "all";
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

export type RemoteInstanceListPage = RemoteInstanceListQuery & {
  total: number;
  totalPages: number;
  items: RemoteInstance[];
};
