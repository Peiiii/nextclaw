export const CORE_HEALTH_CHECK_IDS = ["config", "provider", "workspace", "sessions"] as const;

export type CoreHealthCheckId = (typeof CORE_HEALTH_CHECK_IDS)[number];

export type CoreHealthCheckResult = {
  id: CoreHealthCheckId;
  ok: boolean;
  /** 失败原因；ok 时省略 */
  detail?: string;
  checkedAt: string;
};

/** 最小核心健康快照：evaluate() 每次现查，无缓存、无轮询。 */
export type CoreHealthStatus = {
  /** 全部核心检查通过 */
  healthy: boolean;
  checks: CoreHealthCheckResult[];
  evaluatedAt: string;
};
