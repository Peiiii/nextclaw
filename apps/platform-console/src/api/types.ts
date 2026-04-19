export type Role = 'admin' | 'user';

export type UserView = {
  id: string;
  email: string;
  username: string | null;
  role: Role;
  freeLimitUsd: number;
  freeUsedUsd: number;
  freeRemainingUsd: number;
  paidBalanceUsd: number;
  createdAt: string;
  updatedAt: string;
};

export type AuthResult = {
  token: string;
  user: UserView;
};

export type UpdateProfileInput = {
  username: string;
};

export type EmailCodeSendResult = {
  email: string;
  maskedEmail: string;
  expiresAt: string;
  resendAfterSeconds: number;
  debugCode?: string;
};

export type BillingOverview = {
  user: UserView;
  globalFreeLimitUsd: number;
  globalFreeUsedUsd: number;
  globalFreeRemainingUsd: number;
};

export type LedgerItem = {
  id: string;
  userId: string;
  kind: string;
  amountUsd: number;
  freeAmountUsd: number;
  paidAmountUsd: number;
  model: string | null;
  promptTokens: number;
  completionTokens: number;
  requestId: string | null;
  note: string | null;
  createdAt: string;
};

export type RechargeIntentItem = {
  id: string;
  userId: string;
  amountUsd: number;
  status: 'pending' | 'confirmed' | 'rejected';
  note: string | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  confirmedByUserId: string | null;
  rejectedAt: string | null;
  rejectedByUserId: string | null;
};

export type AdminOverview = {
  globalFreeLimitUsd: number;
  globalFreeUsedUsd: number;
  globalFreeRemainingUsd: number;
  userCount: number;
  pendingRechargeIntents: number;
};

export type RemoteInstance = {
  id: string;
  instanceInstallId: string;
  displayName: string;
  platform: string;
  appVersion: string;
  localOrigin: string;
  status: 'online' | 'offline';
  lastSeenAt: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RemoteAccessSession = {
  id: string;
  instanceId: string;
  status: 'active' | 'closed' | 'expired' | 'revoked';
  sourceType: 'owner_open' | 'share_grant';
  sourceGrantId: string | null;
  expiresAt: string;
  lastUsedAt: string;
  revokedAt: string | null;
  createdAt: string;
  openUrl: string;
  fixedDomainOpenUrl: string | null;
};

export type RemoteShareGrant = {
  id: string;
  instanceId: string;
  status: 'active' | 'revoked' | 'expired';
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  shareUrl: string;
  activeSessionCount: number;
};

export type RemoteQuotaUsageSummary = {
  limit: number;
  used: number;
  remaining: number;
};

export type RemoteQuotaPlatformUsageSummary = {
  configuredLimit: number;
  enforcedLimit: number;
  used: number;
  remaining: number;
};

export type RemoteQuotaSummary = {
  dayKey: string;
  resetsAt: string;
  sessionRequestsPerMinute: number;
  instanceConnectionsPerInstance: number;
  activeBrowserConnections: number;
  workerRequests: RemoteQuotaUsageSummary;
  durableObjectRequests: RemoteQuotaUsageSummary;
};

export type AdminRemoteQuotaSummary = {
  dayKey: string;
  resetsAt: string;
  reservePercent: number;
  sessionRequestsPerMinute: number;
  instanceConnectionsPerInstance: number;
  defaultUserWorkerBudget: number;
  defaultUserDoBudget: number;
  workerRequests: RemoteQuotaPlatformUsageSummary;
  durableObjectRequests: RemoteQuotaPlatformUsageSummary;
};

export type OwnerMarketplaceSkillVisibility = 'public' | 'hidden';
export type OwnerMarketplaceSkillManageAction = 'hide' | 'show' | 'delete';

export type OwnerMarketplaceSkillSummaryView = {
  id: string;
  slug: string;
  packageName: string;
  ownerScope: string;
  skillName: string;
  name: string;
  summary: string;
  author: string;
  tags: string[];
  publishStatus: 'pending' | 'published' | 'rejected';
  publishedByType: 'admin' | 'user';
  ownerVisibility: OwnerMarketplaceSkillVisibility;
  reviewNote?: string;
  reviewedAt?: string;
  publishedAt: string;
  updatedAt: string;
};

export type OwnerMarketplaceSkillDetailView = OwnerMarketplaceSkillSummaryView & {
  summaryI18n: Record<string, string>;
  description?: string;
  descriptionI18n?: Record<string, string>;
  sourceRepo?: string;
  homepage?: string;
  install: {
    kind: string;
    spec: string;
    command?: string;
    sourceUrl?: string;
  };
  canShow: boolean;
  canHide: boolean;
  canDelete: boolean;
};

export type OwnerMarketplaceSkillListView = {
  total: number;
  items: OwnerMarketplaceSkillSummaryView[];
};

export type OwnerMarketplaceAppVisibility = 'public' | 'hidden';
export type OwnerMarketplaceAppManageAction = 'hide' | 'show' | 'delete';

export type MarketplaceAppInstallView = {
  kind: 'registry';
  spec: string;
  command: string;
  registry: string;
};

export type MarketplaceAppPublisherView = {
  id: string;
  name: string;
  url?: string;
};

export type MarketplaceAppManifestView = {
  schemaVersion: 1;
  id: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  main: {
    kind: 'wasm';
    entry: string;
    export: string;
    action: string;
  };
  ui: {
    entry: string;
  };
  permissions?: Record<string, unknown>;
};

export type MarketplaceAppVersionView = {
  version: string;
  publishedAt: string;
  updatedAt: string;
  bundleSha256: string;
  downloadPath: string;
};

export type OwnerMarketplaceAppSummaryView = {
  id: string;
  slug: string;
  appId: string;
  ownerScope: string;
  appName: string;
  name: string;
  summary: string;
  summaryI18n: Record<string, string>;
  tags: string[];
  author: string;
  updatedAt: string;
  latestVersion: string;
  featured: boolean;
  publisher: MarketplaceAppPublisherView;
  install: MarketplaceAppInstallView;
  webUrl: string;
  publishStatus: 'pending' | 'published' | 'rejected';
  publishedByType: 'admin' | 'user';
  ownerVisibility: OwnerMarketplaceAppVisibility;
  reviewNote?: string;
  reviewedAt?: string;
  publishedAt: string;
};

export type OwnerMarketplaceAppDetailView = OwnerMarketplaceAppSummaryView & {
  description?: string;
  descriptionI18n?: Record<string, string>;
  sourceRepo?: string;
  homepage?: string;
  manifest: MarketplaceAppManifestView;
  permissions: Record<string, unknown>;
  versions: MarketplaceAppVersionView[];
  canShow: boolean;
  canHide: boolean;
  canDelete: boolean;
};

export type OwnerMarketplaceAppListView = {
  total: number;
  items: OwnerMarketplaceAppSummaryView[];
};

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type ApiEnvelope<T> = {
  ok: true;
  data: T;
};

export type ApiFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};
