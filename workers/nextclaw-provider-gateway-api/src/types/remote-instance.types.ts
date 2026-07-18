export type RemoteInstanceStatus = "online" | "offline";
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

export type RemoteInstanceRow = {
  id: string;
  user_id: string;
  instance_install_id: string;
  display_name: string;
  platform: string;
  app_version: string;
  local_origin: string;
  status: RemoteInstanceStatus;
  last_seen_at: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RemoteAccessSessionSourceType = "owner_open" | "share_grant";

export type RemoteAccessSessionRow = {
  id: string;
  token: string;
  user_id: string;
  instance_id: string;
  status: "active" | "closed" | "expired";
  source_type: RemoteAccessSessionSourceType;
  source_grant_id: string | null;
  opened_by_user_id: string | null;
  expires_at: string;
  last_used_at: string;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RemoteShareGrantRow = {
  id: string;
  token: string;
  owner_user_id: string;
  instance_id: string;
  status: "active" | "revoked" | "expired";
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
  active_session_count?: number;
};

export type RemoteInstanceView = {
  id: string;
  instanceInstallId: string;
  displayName: string;
  platform: string;
  appVersion: string;
  localOrigin: string;
  status: RemoteInstanceStatus;
  lastSeenAt: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RemoteInstanceListView = RemoteInstanceListQuery & {
  total: number;
  totalPages: number;
  items: RemoteInstanceView[];
};

export type RemoteAccessSessionView = {
  id: string;
  instanceId: string;
  status: "active" | "closed" | "expired" | "revoked";
  sourceType: RemoteAccessSessionSourceType;
  sourceGrantId: string | null;
  expiresAt: string;
  lastUsedAt: string;
  revokedAt: string | null;
  createdAt: string;
  openUrl: string;
  fixedDomainOpenUrl: string | null;
};

export type RemoteShareGrantView = {
  id: string;
  instanceId: string;
  status: "active" | "revoked" | "expired";
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  shareUrl: string;
  activeSessionCount: number;
};
