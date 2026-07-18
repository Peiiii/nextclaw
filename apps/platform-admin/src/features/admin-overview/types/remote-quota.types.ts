export type RemoteQuotaResourceSummary = {
  limit: number;
  actualUsed: number;
  reserved: number;
  remaining: number;
};

export type RemoteQuotaPlatformResourceSummary = RemoteQuotaResourceSummary & {
  configuredLimit: number;
};

export type AdminRemoteQuotaSummary = {
  costModel: {
    version: number;
    verifiedAt: string;
    observedThrough: string;
    partialDay: boolean;
    stale: boolean;
  };
  day: {
    startsAt: string;
    resetsAt: string;
    status: 'normal' | 'near_limit' | 'exhausted';
    utilization: number;
    limitingResource: 'worker_requests' | 'durable_object_requests';
    workerRequests: RemoteQuotaPlatformResourceSummary;
    durableObjectRequests: RemoteQuotaPlatformResourceSummary;
  };
  recent: {
    bucketSeconds: number;
    last30Minutes: { workerRequests: number; durableObjectRequests: number };
    lastHour: { workerRequests: number; durableObjectRequests: number };
    buckets: Array<{
      startedAt: string;
      workerRequests: number;
      durableObjectRequests: number;
    }>;
  };
  protection: {
    runawayGuard: 'shadow';
    activeUntil: null;
  };
  reservePercent: number;
  instanceConnectionsPerInstance: number;
  defaultUserWorkerBudget: number;
  defaultUserDoBudget: number;
  plan: {
    id: 'workers-free';
    resetsAt: '00:00Z';
    workerRequestsPerDay: number;
    durableObjectRequestsPerDay: number;
  };
  calibration: {
    status: 'bootstrap_capacity_contract';
    safetyReservePercent: number;
    supportedHeavyUsers: number;
    basis: 'official_free_limit_minus_shared_platform_reserve';
  };
};
