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
