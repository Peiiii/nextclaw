export type Env = {
  DASHSCOPE_API_KEY?: string;
  DASHSCOPE_API_BASE?: string;
  AUTH_TOKEN_SECRET?: string;
  GLOBAL_FREE_USD_LIMIT?: string;
  DEFAULT_USER_FREE_USD_LIMIT?: string;
  REQUEST_FLAT_USD_PER_REQUEST?: string;
  NEXTCLAW_PLATFORM_DB: D1Database;
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
  role: UserRole;
  iat: number;
  exp: number;
};

export type UserRow = {
  id: string;
  email: string;
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

export type CursorPayload = {
  createdAt: string;
  id: string;
};

export const DEFAULT_DASHSCOPE_API_BASE = "https://dashscope.aliyuncs.com/compatible-mode/v1";
export const DEFAULT_GLOBAL_FREE_USD_LIMIT = 20;
export const DEFAULT_USER_FREE_USD_LIMIT = 2;
export const DEFAULT_REQUEST_FLAT_USD_PER_REQUEST = 0.0002;
export const DEFAULT_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
export const PASSWORD_HASH_ITERATIONS = 120_000;
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
