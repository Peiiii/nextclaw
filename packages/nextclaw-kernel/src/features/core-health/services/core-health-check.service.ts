import { accessSync, constants, statSync } from "node:fs";
import { dirname } from "node:path";
import type { Config } from "@nextclaw/core";
import {
  CORE_HEALTH_CHECK_IDS,
  type CoreHealthCheckId,
  type CoreHealthCheckResult,
  type CoreHealthStatus,
} from "@kernel/features/core-health/types/core-health.types.js";

const PUBLIC_REASON_CODE_MAP: Record<string, Record<string, string>> = {
  config: { "config is unavailable": "unconfigured", "agents defaults are missing": "unconfigured" },
  provider: { "no-enabled-provider": "no-enabled-provider", "no-key-configured": "no-key-configured" },
  workspace: {
    notWritable: "not-writable",
  },
  sessions: {
    notWritable: "not-writable",
  },
};

const notWritablePattern = /^not writable:/i;

function toPublicReasonCode(id: string, detail: string): string {
  // 绝对路径 / 原始异常统一收敛为稳定的 short code。
  if (notWritablePattern.test(detail)) return "not-writable";
  const codes = PUBLIC_REASON_CODE_MAP[id];
  if (!codes) return `check-failed:${id}`;
  if (codes[detail] !== undefined) return codes[detail];
  return `unconfigured`;
}

export type CoreHealthCheckServiceDeps = {
  getConfig: () => Config;
  getWorkspacePath: () => string;
  sessionsDir: string;
};

/**
 * 最小核心健康检查（自感知层）：判定核心层部件（配置 / provider / 工作区 /
 * 会话）当前是否可用，是整个故障自修复闭环的事实源。
 *
 * 闭环模型（机器人视角）：坏了 → 感知（本 service 产出快照）→ 降级
 * （PR-2 按 checks 关闭外部多余功能，保住最小核心）→ 排查（PR-3 心跳计时 +
 * 连续失败定位故障部件）→ 修部件（自动重试/重启/恢复配置）→ 调优（PR-4 按
 * 快照历史调整运行参数）。
 *
 * evaluate() 是纯读快照：不发网络请求、不创建目录、不缓存；单项失败只记录
 * detail，不向上传播异常——健康检查自身不能成为新的崩溃点。
 *
 * toPublicSnapshot() 输出仅面向公共端点（如 /api/health），将 detail 收窄为
 * 稳定 reason code，隐藏绝对路径、原始异常等可能泄露本机环境信息的细节。
 */
export class CoreHealthCheckService {
  constructor(private readonly deps: CoreHealthCheckServiceDeps) {}

  readonly evaluate = (): CoreHealthStatus => {
    const checks = CORE_HEALTH_CHECK_IDS.map((id) => this.evaluateCheck(id));
    return {
      healthy: checks.every((check) => check.ok),
      checks,
      evaluatedAt: new Date().toISOString(),
    };
  };

  /**
   * 面向未登录可访问端点（如 /api/health）的脱敏快照：把 detail 统一收敛为
   * 稳定 reason code，避免暴露绝对路径与原始异常。保留原始 checks 供已鉴权
   * 的诊断面（日志、诊断面板）消费。
   */
  readonly toPublicSnapshot = (): CoreHealthStatus => {
    const checks = CORE_HEALTH_CHECK_IDS.map((id) => this.evaluateCheck(id));
    return {
      healthy: checks.every((check) => check.ok),
      checks: checks.map((c) =>
        c.ok ? c : { ...c, detail: toPublicReasonCode(c.id, c.detail ?? "") },
      ),
      evaluatedAt: new Date().toISOString(),
    };
  };

  private readonly evaluateCheck = (id: CoreHealthCheckId): CoreHealthCheckResult => {
    const checkedAt = new Date().toISOString();
    try {
      const detail = this.runCheck(id);
      return detail === undefined ? { id, ok: true, checkedAt } : { id, ok: false, detail, checkedAt };
    } catch (error) {
      return {
        id,
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
        checkedAt,
      };
    }
  };

  /** 返回 undefined 表示通过；返回字符串表示失败原因。 */
  private readonly runCheck = (id: CoreHealthCheckId): string | undefined => {
    switch (id) {
      case "config":
        return this.checkConfig();
      case "provider":
        return this.checkProvider();
      case "workspace":
        return this.checkWritableDir(this.deps.getWorkspacePath());
      case "sessions":
        return this.checkWritableDir(this.deps.sessionsDir);
    }
  };

  private readonly checkConfig = (): string | undefined => {
    const config = this.deps.getConfig();
    if (!config || typeof config !== "object") {
      return "config is unavailable";
    }
    const agents = config.agents;
    if (!agents || typeof agents.defaults?.workspace !== "string") {
      return "agents defaults are missing";
    }
    return undefined;
  };

  private readonly checkProvider = (): string | undefined => {
    const providers = this.deps.getConfig().providers;
    const enabled = Object.entries(providers ?? {}).filter(([, spec]) => spec.enabled);
    if (enabled.length === 0) {
      return "no-enabled-provider";
    }
    const withKey = enabled.some(([, spec]) => (spec.apiKey ?? "").trim().length > 0);
    if (!withKey) {
      return "no-key-configured";
    }
    return undefined;
  };

  /**
   * 探测目录当前可写：沿路径向上找到最近的已存在祖先，它必须是可写目录
   * （已存在则直接判可写；尚不存在的层级依赖该祖先可写即可创建）。
   */
  private readonly checkWritableDir = (path: string): string | undefined => {
    let current = path;
    while (current !== dirname(current)) {
      try {
        const stat = statSync(current);
        if (!stat.isDirectory()) {
          return `not a directory: ${current}`;
        }
        accessSync(current, constants.W_OK);
        return undefined;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          return `not writable: ${path}`;
        }
        current = dirname(current);
      }
    }
    return `not writable: ${path}`;
  };
}
