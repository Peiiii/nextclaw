import type { CoreHealthCheckId } from "@kernel/features/core-health/index.js";

/**
 * 最小核心自愈状态机 phase。
 *
 * 状态转换：
 *   disabled     → healthy（enabled=false，不启动心跳）
 *   healthy      → failing（连续失败 < 阈值）→ degraded（≥ 阈值）
 *   degraded     → repairing（触发修复）→ healthy（恢复）/ repair-exhausted（未恢复）
 *   repair-exhausted → failing（下次心跳重新评估）
 */
export type CoreSelfHealPhase =
  | "disabled"
  | "healthy"
  | "failing"
  | "degraded"
  | "repairing"
  | "repair-exhausted";

export type CoreSelfHealRepairRecord = {
  at: string;
  checkId: CoreHealthCheckId;
  action: "config-reload" | "directory-ensure";
  recovered: boolean;
  detail?: string;
};

export type CoreSelfHealCheckState = {
  id: CoreHealthCheckId;
  consecutiveFailures: number;
  lastFailureAt?: string;
  repairCount: number;
  lastRepairAt?: string;
};

export type CoreSelfHealStatus = {
  phase: CoreSelfHealPhase;
  healthy: boolean;
  failedCheckIds: CoreHealthCheckId[];
  consecutiveFailures: number;
  lastHeartbeatAt?: string;
  lastRepair?: CoreSelfHealRepairRecord;
  checks: CoreSelfHealCheckState[];
};
