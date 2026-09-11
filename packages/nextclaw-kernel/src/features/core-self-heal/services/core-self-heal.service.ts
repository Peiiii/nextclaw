import { mkdirSync } from "node:fs";
import type { Config } from "@nextclaw/core";
import {
  CORE_HEALTH_CHECK_IDS,
  type CoreHealthCheckId,
  type CoreHealthStatus,
} from "@kernel/features/core-health/index.js";
import {
  type CoreSelfHealCheckState,
  type CoreSelfHealPhase,
  type CoreSelfHealRepairRecord,
  type CoreSelfHealStatus,
} from "@kernel/features/core-self-heal/types/core-self-heal.types.js";

/** 速率限制滑动窗口：每检查 id 一小时内最多 maxRepairsPerHour 次修复 */
const REPAIR_WINDOW_MS = 3_600_000;

export type CoreSelfHealServiceDeps = {
  /** 每次心跳读取最新配置（enabled/intervalMs 等运行时参数支持热切换） */
  getConfig: () => Config;
  /** core-health 的纯快照探测（PR-1 契约） */
  coreHealthEvaluate: () => CoreHealthStatus;
  /** 修复动作：config-reload（config/provider 检查失败时执行） */
  applyConfigReload: () => Promise<void>;
  /** 修复动作：directory-ensure 的目标路径 */
  getWorkspacePath: () => string;
  sessionsDir: string;
};

type CoreSelfHealInternalCheck = Omit<CoreSelfHealCheckState, "repairCount" | "lastRepairAt"> & {
  /** 滑动窗口内的修复记录（对外快照只暴露派生的 repairCount/lastRepairAt） */
  repairHistory: CoreSelfHealRepairRecord[];
};

/**
 * 最小核心自愈服务（闭环环节③④）：心跳计时 + 连续失败定位故障部件 + 按检查 id 执行修复动作。
 *
 * 状态机时序（每次心跳一个判定）：
 *   - 检查首次达到 failureThreshold：phase = degraded（确认故障），不执行修复；
 *   - 下一次心跳仍未恢复：执行修复动作（config-reload / directory-ensure，幂等），
 *     修复后立即重新 evaluate() 验证：恢复 → healthy，未恢复 → repair-exhausted；
 *   - repair-exhausted 后等待后续心跳，冷却/速率限制内不重复触发修复。
 *
 * 设计原则：
 *   - evaluate() 无副作用（纯快照）；start() 启动心跳，dispose() 停止心跳。
 *   - 所有修复动作幂等且异常被捕获——自愈自身不能成为新的崩溃点。
 *   - 每次 tick 读取最新配置，enabled/intervalMs 等参数热切换在下一个 tick 生效。
 *   - 公共端点（/api/health）只暴露脱敏快照，不暴露绝对路径或原始异常。
 */
export class CoreSelfHealService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private timerIntervalMs: number | null = null;
  private phase: CoreSelfHealPhase = "disabled";
  private readonly checks: CoreSelfHealInternalCheck[];
  private lastHeartbeatAt: string | undefined;
  private lastRepair: CoreSelfHealRepairRecord | undefined;
  private ticking = false;

  constructor(private readonly deps: CoreSelfHealServiceDeps) {
    this.checks = CORE_HEALTH_CHECK_IDS.map((id) => ({
      id,
      consecutiveFailures: 0,
      lastFailureAt: undefined,
      repairHistory: [],
    }));
  }

  /** 内部完整快照（已鉴权面消费，lastRepair 可能含原始异常 detail） */
  readonly evaluate = (): CoreSelfHealStatus => ({
    phase: this.phase,
    healthy: this.phase === "healthy",
    failedCheckIds: this.checks.filter((c) => c.consecutiveFailures > 0).map((c) => c.id),
    consecutiveFailures: Math.max(0, ...this.checks.map((c) => c.consecutiveFailures)),
    lastHeartbeatAt: this.lastHeartbeatAt,
    lastRepair: this.lastRepair,
    checks: this.checks.map((c) => ({
      id: c.id,
      consecutiveFailures: c.consecutiveFailures,
      lastFailureAt: c.lastFailureAt,
      repairCount: c.repairHistory.length,
      lastRepairAt: lastRecord(c.repairHistory)?.at,
    })),
  });

  /** 公共端点快照：只保留固定枚举、计数、时间戳与稳定 phase，剥离原始异常 detail */
  readonly toPublicSnapshot = (): CoreSelfHealStatus => {
    const status = this.evaluate();
    return {
      ...status,
      lastRepair: status.lastRepair
        ? {
            at: status.lastRepair.at,
            checkId: status.lastRepair.checkId,
            action: status.lastRepair.action,
            recovered: status.lastRepair.recovered,
          }
        : undefined,
    };
  };

  readonly start = (): void => {
    const selfHeal = this.deps.getConfig().coreHealth.selfHeal;
    if (!selfHeal.enabled) {
      this.phase = "disabled";
      return;
    }
    // 首个心跳前的乐观初值；首个心跳到达后由实际快照修正
    this.phase = "healthy";
    this.ensureTimer(selfHeal.intervalMs);
  };

  readonly dispose = (): void => {
    if (this.timer !== null) {
      clearInterval(this.timer);
    }
    this.timer = null;
    this.timerIntervalMs = null;
  };

  private readonly ensureTimer = (intervalMs: number): void => {
    if (this.timer !== null && this.timerIntervalMs === intervalMs) {
      return;
    }
    if (this.timer !== null) {
      clearInterval(this.timer);
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);
    this.timerIntervalMs = intervalMs;
    // CLI 命令会构造 kernel 但不长时间运行，计时器不能阻止进程退出
    if (typeof this.timer.unref === "function") {
      this.timer.unref();
    }
  };

  private readonly tick = async (): Promise<void> => {
    if (this.ticking) {
      return;
    }
    this.ticking = true;
    try {
      const selfHeal = this.deps.getConfig().coreHealth.selfHeal;
      if (!selfHeal.enabled) {
        this.dispose();
        this.phase = "disabled";
        return;
      }
      // intervalMs 热切换：与当前计时器不一致时重建
      this.ensureTimer(selfHeal.intervalMs);

      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      this.lastHeartbeatAt = nowIso;
      this.pruneRepairWindow(now);

      const snapshot = this.deps.coreHealthEvaluate();
      const failedIds = new Set(snapshot.checks.filter((c) => !c.ok).map((c) => c.id));
      for (const check of this.checks) {
        if (failedIds.has(check.id)) {
          check.consecutiveFailures += 1;
          check.lastFailureAt = nowIso;
        } else {
          check.consecutiveFailures = 0;
        }
      }

      const failing = this.checks.filter((c) => c.consecutiveFailures > 0);
      if (failing.length === 0) {
        this.phase = "healthy";
        return;
      }

      const overThreshold = failing.filter((c) => c.consecutiveFailures >= selfHeal.failureThreshold);
      if (overThreshold.length === 0) {
        this.phase = "failing";
        return;
      }

      // 首次达到阈值只确认故障（degraded），不执行修复；
      // 之后的心跳仍在 degraded/repair-exhausted 态才触发修复动作（设计 3.3）。
      const confirmed = this.phase === "degraded" || this.phase === "repair-exhausted";
      if (!confirmed) {
        this.phase = "degraded";
        return;
      }

      const eligible = overThreshold.filter((c) =>
        this.canRepair(c, now, selfHeal.maxRepairsPerHour, selfHeal.repairCooldownMs),
      );
      if (eligible.length === 0) {
        // 冷却或速率限制中，等待下次心跳重试
        this.phase = "repair-exhausted";
        return;
      }

      this.phase = "repairing";
      for (const check of eligible) {
        await this.attemptRepair(check, nowIso);
      }
      this.phase = this.checks.some((c) => c.consecutiveFailures > 0) ? "repair-exhausted" : "healthy";
    } finally {
      this.ticking = false;
    }
  };

  private readonly canRepair = (
    check: CoreSelfHealInternalCheck,
    now: number,
    maxRepairsPerHour: number,
    repairCooldownMs: number,
  ): boolean => {
    if (check.repairHistory.length >= maxRepairsPerHour) {
      return false;
    }
    const last = lastRecord(check.repairHistory);
    if (last && now - new Date(last.at).getTime() < repairCooldownMs) {
      return false;
    }
    return true;
  };

  private readonly pruneRepairWindow = (now: number): void => {
    for (const check of this.checks) {
      check.repairHistory = check.repairHistory.filter(
        (record) => now - new Date(record.at).getTime() <= REPAIR_WINDOW_MS,
      );
    }
  };

  private readonly attemptRepair = async (check: CoreSelfHealInternalCheck, nowIso: string): Promise<void> => {
    const action = check.id === "config" || check.id === "provider" ? "config-reload" : "directory-ensure";
    let recovered = false;
    let detail: string | undefined;
    try {
      if (action === "config-reload") {
        await this.deps.applyConfigReload();
      } else {
        const dir = check.id === "workspace" ? this.deps.getWorkspacePath() : this.deps.sessionsDir;
        mkdirSync(dir, { recursive: true });
      }
      // 修复后立即重新探测，验证恢复效果（纯内存探测，微秒级）
      const snapshot = this.deps.coreHealthEvaluate();
      recovered = snapshot.checks.some((c) => c.id === check.id && c.ok);
      if (recovered) {
        check.consecutiveFailures = 0;
      }
    } catch (error) {
      // 健康检查自身不能成为新的崩溃点：异常只记录为修复失败，不传播
      detail = error instanceof Error ? error.message : String(error);
    }
    const record: CoreSelfHealRepairRecord = {
      at: nowIso,
      checkId: check.id,
      action,
      recovered,
      ...(detail ? { detail } : {}),
    };
    check.repairHistory.push(record);
    this.lastRepair = record;
  };
}

function lastRecord(records: CoreSelfHealRepairRecord[]): CoreSelfHealRepairRecord | undefined {
  return records.length > 0 ? records[records.length - 1] : undefined;
}
