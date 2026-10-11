/**
 * 最小核心（阿米巴模型）健康检查 ID 全集。
 * 对应"机器人故障自修复"闭环的感知环节：核心层（配置 / provider / 工作区 / 会话）
 * 任一部件不可用，系统就降级到只保留这些核心能力、关闭外部多余功能，再进入
 * 排查（PR-3）→ 修复部件 → 恢复 → 调优（PR-4）的后续环节。
 */
export const CORE_HEALTH_CHECK_IDS = ["config", "provider", "workspace", "sessions"] as const;

export type CoreHealthCheckId = (typeof CORE_HEALTH_CHECK_IDS)[number];

export type CoreHealthCheckResult = {
  id: CoreHealthCheckId;
  ok: boolean;
  /** 失败原因；ok 时省略 */
  detail?: string;
  checkedAt: string;
};

/**
 * 最小核心健康快照（自感知的事实源）：evaluate() 每次现查，无缓存、无轮询。
 * 下游环节都只消费这份快照——降级开关（PR-2）按 checks 决定关闭哪些外部功能，
 * 自愈重启（PR-3）按 healthy 连续失败触发排查与部件修复，调优（PR-4）用
 * 长期快照历史回看哪个部件反复出问题并调整运行参数。
 */
export type CoreHealthStatus = {
  /** 全部核心检查通过 */
  healthy: boolean;
  checks: CoreHealthCheckResult[];
  evaluatedAt: string;
};
