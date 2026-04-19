export type Env = {
  DASHSCOPE_API_KEY?: string;
  DASHSCOPE_API_BASE?: string;
  AUTH_TOKEN_SECRET?: string;
  MARKETPLACE_API_BASE?: string;
  MARKETPLACE_ADMIN_TOKEN?: string;
  NEXTCLAW_WEB_BASE_URL?: string;
  REMOTE_ACCESS_BASE_DOMAIN?: string;
  REMOTE_ACCESS_FIXED_DOMAIN?: string;
  PLATFORM_AUTH_EMAIL_PROVIDER?: string;
  PLATFORM_AUTH_EMAIL_FROM?: string;
  PLATFORM_AUTH_DEV_EXPOSE_CODE?: string;
  RESEND_API_KEY?: string;
  GLOBAL_FREE_USD_LIMIT?: string;
  DEFAULT_USER_FREE_USD_LIMIT?: string;
  REQUEST_FLAT_USD_PER_REQUEST?: string;
  REMOTE_QUOTA_SESSION_REQUESTS_PER_MINUTE?: string;
  REMOTE_QUOTA_INSTANCE_CONNECTIONS?: string;
  REMOTE_PLATFORM_DAILY_WORKER_REQUEST_BUDGET?: string;
  REMOTE_PLATFORM_DAILY_DO_REQUEST_BUDGET?: string;
  REMOTE_PLATFORM_DAILY_RESERVE_PERCENT?: string;
  REMOTE_QUOTA_USER_DAILY_WORKER_REQUEST_UNITS?: string;
  REMOTE_QUOTA_USER_DAILY_DO_REQUEST_UNITS?: string;
  REMOTE_QUOTA_WS_MESSAGE_LEASE_SIZE?: string;
  NEXTCLAW_PLATFORM_DB: D1Database;
  NEXTCLAW_REMOTE_RELAY: DurableObjectNamespace;
  NEXTCLAW_REMOTE_QUOTA: DurableObjectNamespace;
};

export type SupportedModelSpec = {
  id: string;
  upstreamModel: string;
  displayName: string;
  inputUsdPer1M: number;
  outputUsdPer1M: number;
};

export type ChatCompletionRequest = {
  model: string;
  messages: Array<Record<string, unknown>>;
  stream?: boolean;
  max_tokens?: number;
  max_completion_tokens?: number;
  [key: string]: unknown;
};

export type UsageCounters = {
  promptTokens: number;
  completionTokens: number;
};

export type ProviderAuthType = "oauth" | "api_key";

export type UserRole = "admin" | "user";

export type SessionTokenPayload = {
  sub: string;
  email: string;
  username?: string | null;
  role: UserRole;
  iat: number;
  exp: number;
};

export type UserRow = {
  id: string;
  email: string;
  username: string | null;
  password_hash: string;
  password_salt: string;
  role: UserRole;
  free_limit_usd: number;
  free_used_usd: number;
  paid_balance_usd: number;
  created_at: string;
  updated_at: string;
};

export type UserSecurityRow = {
  user_id: string;
  failed_login_attempts: number;
  login_locked_until: string | null;
  updated_at: string;
};

export type UserPublicView = {
  id: string;
  email: string;
  username: string | null;
  role: UserRole;
  freeLimitUsd: number;
  freeUsedUsd: number;
  freeRemainingUsd: number;
  paidBalanceUsd: number;
  createdAt: string;
  updatedAt: string;
};

export type RechargeIntentRow = {
  id: string;
  user_id: string;
  amount_usd: number;
  status: "pending" | "confirmed" | "rejected";
  note: string | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  confirmed_by_user_id: string | null;
  rejected_at: string | null;
  rejected_by_user_id: string | null;
};

export type LedgerRow = {
  id: string;
  user_id: string;
  kind: string;
  amount_usd: number;
  free_amount_usd: number;
  paid_amount_usd: number;
  model: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  request_id: string | null;
  note: string | null;
  created_at: string;
};

export type RemoteInstanceStatus = "online" | "offline";

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

export type PlatformAuthSessionStatus = "pending" | "authorized" | "expired";

export type PlatformAuthSessionRow = {
  id: string;
  user_id: string | null;
  status: PlatformAuthSessionStatus;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export type ProviderAccountRow = {
  id: string;
  provider: string;
  display_name: string | null;
  auth_type: ProviderAuthType;
  api_base: string;
  access_token: string;
  enabled: number;
  priority: number;
  created_at: string;
  updated_at: string;
};

export type ModelCatalogRow = {
  public_model_id: string;
  provider_account_id: string;
  upstream_model: string;
  display_name: string | null;
  enabled: number;
  sell_input_usd_per_1m: number;
  sell_output_usd_per_1m: number;
  upstream_input_usd_per_1m: number;
  upstream_output_usd_per_1m: number;
  created_at: string;
  updated_at: string;
};

export type ProfitLedgerRow = {
  id: string;
  request_id: string;
  user_id: string;
  public_model_id: string;
  provider_account_id: string | null;
  upstream_model: string;
  charge_usd: number;
  upstream_cost_usd: number;
  gross_margin_usd: number;
  created_at: string;
};

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

export type RuntimeModelSpec = {
  id: string;
  displayName: string;
  upstreamModel: string;
  apiBase: string;
  accessToken: string;
  providerAccountId: string | null;
  sellInputUsdPer1M: number;
  sellOutputUsdPer1M: number;
  upstreamInputUsdPer1M: number;
  upstreamOutputUsdPer1M: number;
};

export type BillingSnapshot = {
  user: UserRow;
  globalFreeLimitUsd: number;
  globalFreeUsedUsd: number;
};

export type ChargeSplit = {
  totalCostUsd: number;
  freePartUsd: number;
  paidPartUsd: number;
};

export type ChargeResult =
  | {
    ok: true;
    split: ChargeSplit;
    snapshot: BillingSnapshot;
  }
  | {
    ok: false;
    reason: "insufficient_quota";
    snapshot: BillingSnapshot;
  };

export type AdminMarketplaceSkillPublishStatus = "pending" | "published" | "rejected" | "all";
export type AdminMarketplaceSkillReviewStatus = "published" | "rejected";
export type OwnerMarketplaceSkillVisibility = "public" | "hidden";
export type OwnerMarketplaceSkillManageAction = "hide" | "show" | "delete";
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
  publishStatus: Exclude<AdminMarketplaceSkillPublishStatus, "all">;
  publishedByType: "admin" | "user";
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
  publishStatus: Exclude<AdminMarketplaceSkillPublishStatus, "all">;
  publishedByType: "admin" | "user";
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
  install: MarketplaceSkillInstallView;
  canShow: boolean;
  canHide: boolean;
  canDelete: boolean;
};
export type OwnerMarketplaceSkillListView = {
  total: number;
  items: OwnerMarketplaceSkillSummaryView[];
};

export type AdminMarketplaceAppPublishStatus = "pending" | "published" | "rejected" | "all";
export type AdminMarketplaceAppReviewStatus = "published" | "rejected";
export type OwnerMarketplaceAppVisibility = "public" | "hidden";
export type OwnerMarketplaceAppManageAction = "hide" | "show" | "delete";

export type MarketplaceAppInstallView = {
  kind: "registry";
  spec: string;
  command: string;
  registry: string;
};

export type MarketplaceAppFileView = {
  path: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  updatedAt: string;
  downloadPath?: string;
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
    kind: "wasm";
    entry: string;
    export: string;
    action: string;
  };
  ui: {
    entry: string;
  };
  permissions?: Record<string, unknown>;
};

export type MarketplaceAppPermissionsView = Record<string, unknown>;

export type MarketplaceAppVersionView = {
  version: string;
  publishedAt: string;
  updatedAt: string;
  bundleSha256: string;
  downloadPath: string;
};

export type AdminMarketplaceAppCountsView = {
  pending: number;
  published: number;
  rejected: number;
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
  publishStatus: Exclude<AdminMarketplaceAppPublishStatus, "all">;
  publishedByType: "admin" | "user";
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
  permissions: MarketplaceAppPermissionsView;
  versions: MarketplaceAppVersionView[];
  canShow: boolean;
  canHide: boolean;
  canDelete: boolean;
};

export type OwnerMarketplaceAppListView = {
  total: number;
  items: OwnerMarketplaceAppSummaryView[];
};

export type AdminMarketplaceAppSummaryView = {
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
  publishStatus: Exclude<AdminMarketplaceAppPublishStatus, "all">;
  publishedByType: "admin" | "user";
  reviewNote?: string;
  reviewedAt?: string;
  publishedAt: string;
};

export type AdminMarketplaceAppDetailView = AdminMarketplaceAppSummaryView & {
  description?: string;
  descriptionI18n?: Record<string, string>;
  sourceRepo?: string;
  homepage?: string;
  manifest: MarketplaceAppManifestView;
  permissions: MarketplaceAppPermissionsView;
  versions: MarketplaceAppVersionView[];
};

export type AdminMarketplaceAppListView = {
  counts: AdminMarketplaceAppCountsView;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  publishStatus: AdminMarketplaceAppPublishStatus;
  query?: string;
  items: AdminMarketplaceAppSummaryView[];
};

export type AdminMarketplaceAppDetailPayload = {
  item: AdminMarketplaceAppDetailView;
  files: MarketplaceAppFileView[];
  readmeRaw?: string;
  marketplaceJsonRaw?: string;
};
export type CursorPayload = {
  createdAt: string;
  id: string;
};

export const DEFAULT_DASHSCOPE_API_BASE = "https://dashscope.aliyuncs.com/compatible-mode/v1";
export const DEFAULT_GLOBAL_FREE_USD_LIMIT = 20;
export const DEFAULT_USER_FREE_USD_LIMIT = 2;
export const DEFAULT_REQUEST_FLAT_USD_PER_REQUEST = 0.0002;
export const DEFAULT_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
export const DEFAULT_REMOTE_SESSION_TTL_SECONDS = 60 * 60 * 8;
export const DEFAULT_PLATFORM_AUTH_SESSION_TTL_SECONDS = 60 * 15;
export const DEFAULT_PLATFORM_AUTH_POLL_INTERVAL_MS = 1500;
// Cloudflare workerd currently rejects PBKDF2 iteration counts above 100_000.
export const PASSWORD_HASH_ITERATIONS = 100_000;
export const MIN_AUTH_SECRET_LENGTH = 32;
export const MAX_FAILED_LOGIN_ATTEMPTS_PER_USER = 5;
export const ACCOUNT_LOCK_MINUTES = 15;
export const MAX_FAILED_LOGIN_ATTEMPTS_PER_IP_WINDOW = 30;
export const IP_FAILED_ATTEMPT_WINDOW_MINUTES = 10;

export const SUPPORTED_MODELS: SupportedModelSpec[] = [
  {
    id: "dashscope/qwen3.5-plus",
    upstreamModel: "qwen3.5-plus",
    displayName: "Qwen3.5 Plus",
    inputUsdPer1M: 0.8,
    outputUsdPer1M: 2.4
  },
  {
    id: "dashscope/qwen3.5-flash",
    upstreamModel: "qwen3.5-flash",
    displayName: "Qwen3.5 Flash",
    inputUsdPer1M: 0.2,
    outputUsdPer1M: 0.6
  },
  {
    id: "dashscope/qwen3.5-397b-a17b",
    upstreamModel: "qwen3.5-397b-a17b",
    displayName: "Qwen3.5 397B A17B",
    inputUsdPer1M: 1.2,
    outputUsdPer1M: 3.6
  },
  {
    id: "dashscope/qwen3.5-122b-a10b",
    upstreamModel: "qwen3.5-122b-a10b",
    displayName: "Qwen3.5 122B A10B",
    inputUsdPer1M: 0.6,
    outputUsdPer1M: 1.8
  },
  {
    id: "dashscope/qwen3.5-35b-a3b",
    upstreamModel: "qwen3.5-35b-a3b",
    displayName: "Qwen3.5 35B A3B",
    inputUsdPer1M: 0.35,
    outputUsdPer1M: 1.05
  },
  {
    id: "dashscope/qwen3.5-27b",
    upstreamModel: "qwen3.5-27b",
    displayName: "Qwen3.5 27B",
    inputUsdPer1M: 0.28,
    outputUsdPer1M: 0.84
  }
];

export const MODEL_MAP = new Map<string, SupportedModelSpec>(SUPPORTED_MODELS.map((model) => [model.id, model]));
