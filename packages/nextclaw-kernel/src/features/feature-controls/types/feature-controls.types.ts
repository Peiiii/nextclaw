import type { CoreHealthCheckId } from "@kernel/features/core-health/index.js";

/**
 * 外部功能状态：available 是静态/平台能力（既有语义不变），active 是
 * 「现在真的可用」。降级开关（闭环环节②）只作用在 active 上：核心不健康
 * 且 autoDegrade 开启时，外部功能 active=false，最小核心保持运行。
 */
export type ExternalFeatureState = {
  available: boolean;
  active: boolean;
  /** active=false 且非平台能力缺失时的降级原因，如 "core-degraded: provider,workspace" */
  reason?: string;
};

export type CoreHealthControlsView = {
  healthy: boolean;
  autoDegrade: boolean;
  failedCheckIds: CoreHealthCheckId[];
};

export type ProductFeatureControls = {
  desktopAutomation: ExternalFeatureState;
  mcp: ExternalFeatureState;
  core: CoreHealthControlsView;
};
