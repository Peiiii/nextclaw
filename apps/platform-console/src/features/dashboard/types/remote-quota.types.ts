export type RemoteQuotaResourceSummary = {
  limit: number;
  actualUsed: number;
  reserved: number;
  remaining: number;
};

export type RemoteQuotaDaySummary<TResource> = {
  startsAt: string;
  resetsAt: string;
  status: 'normal' | 'near_limit' | 'exhausted';
  utilization: number;
  limitingResource: 'worker_requests' | 'durable_object_requests';
  workerRequests: TResource;
  durableObjectRequests: TResource;
};

export type RemoteQuotaRecentUsage = {
  workerRequests: number;
  durableObjectRequests: number;
};

export type RemoteQuotaRecentSummary = {
  bucketSeconds: number;
  last30Minutes: RemoteQuotaRecentUsage;
  lastHour: RemoteQuotaRecentUsage;
  buckets: Array<RemoteQuotaRecentUsage & { startedAt: string }>;
};

export type RemoteQuotaSummary = {
  costModel: {
    version: number;
    verifiedAt: string;
    observedThrough: string;
    partialDay: boolean;
    stale: boolean;
  };
  day: RemoteQuotaDaySummary<RemoteQuotaResourceSummary>;
  recent: RemoteQuotaRecentSummary;
  protection: {
    runawayGuard: 'shadow';
    activeUntil: null;
  };
  activeBrowserConnections: number;
};
