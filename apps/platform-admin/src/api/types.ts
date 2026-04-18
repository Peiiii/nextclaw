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

export type ProviderAuthType = 'oauth' | 'api_key';

export type ProviderAccountView = {
  id: string;
  provider: string;
  displayName: string | null;
  authType: ProviderAuthType;
  apiBase: string;
  tokenSet: boolean;
  enabled: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
};

export type ModelCatalogView = {
  publicModelId: string;
  providerAccountId: string;
  upstreamModel: string;
  displayName: string | null;
  enabled: boolean;
  sellInputUsdPer1M: number;
  sellOutputUsdPer1M: number;
  upstreamInputUsdPer1M: number;
  upstreamOutputUsdPer1M: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminProfitOverview = {
  days: number;
  since: string;
  requests: number;
  totalChargeUsd: number;
  totalUpstreamCostUsd: number;
  totalGrossMarginUsd: number;
  grossMarginRate: number;
};

export type AdminMarketplaceSkillPublishStatus = 'pending' | 'published' | 'rejected' | 'all';

export type AdminMarketplaceSkillReviewStatus = 'published' | 'rejected';

export type MarketplaceSkillInstallView = {
  kind: string;
  spec: string;
  command?: string;
  sourceUrl?: string;
};

export type MarketplaceSkillFileView = {
  path: string;
  sha256: string;
  sizeBytes: number;
  updatedAt: string;
  downloadPath?: string;
};

export type AdminMarketplaceSkillCountsView = {
  pending: number;
  published: number;
  rejected: number;
};

export type AdminMarketplaceSkillSummaryView = {
  id: string;
  slug: string;
  packageName: string;
  ownerScope: string;
  skillName: string;
  name: string;
  summary: string;
  author: string;
  tags: string[];
  publishStatus: Exclude<AdminMarketplaceSkillPublishStatus, 'all'>;
  publishedByType: 'admin' | 'user';
  reviewNote?: string;
  reviewedAt?: string;
  publishedAt: string;
  updatedAt: string;
};

export type AdminMarketplaceSkillDetailView = AdminMarketplaceSkillSummaryView & {
  summaryI18n: Record<string, string>;
  description?: string;
  descriptionI18n?: Record<string, string>;
  sourceRepo?: string;
  homepage?: string;
  install: MarketplaceSkillInstallView;
};

export type AdminMarketplaceSkillListView = {
  counts: AdminMarketplaceSkillCountsView;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  publishStatus: AdminMarketplaceSkillPublishStatus;
  query?: string;
  items: AdminMarketplaceSkillSummaryView[];
};

export type AdminMarketplaceSkillDetailPayload = {
  item: AdminMarketplaceSkillDetailView;
  files: MarketplaceSkillFileView[];
  skillMarkdownRaw?: string;
  marketplaceJsonRaw?: string;
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
