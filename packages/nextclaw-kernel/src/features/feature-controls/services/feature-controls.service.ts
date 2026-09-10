import type { CoreHealthCheckService } from "@kernel/features/core-health/index.js";
import type { Config } from "@nextclaw/core";
import type { DesktopHost } from "@kernel/features/desktop-host/index.js";
import type {
  CoreHealthControlsView,
  ExternalFeatureState,
  ProductFeatureControls,
} from "@kernel/features/feature-controls/types/feature-controls.types.js";

export type FeatureControlsServiceDeps = {
  desktopHost: DesktopHost;
  coreHealth: CoreHealthCheckService;
  getConfig: () => Config;
};

/**
 * 外部功能可用性 owner（闭环环节②降级开关的单一事实源）。
 *
 * 降级规则刻意只有一条：coreHealth.autoDegrade 开启且最小核心不健康时，
 * 所有外部功能 active=false（关掉外部多余功能，保住核心继续跑）。不建
 * 「部件 → 功能」映射表；PR-3 有了故障部件定位后如需细粒度，再加映射。
 *
 * evaluate() 是纯读快照（微秒级），供 tool provider 热路径直接调用。
 */
export class FeatureControlsService {
  constructor(private readonly deps: FeatureControlsServiceDeps) {}

  get = async (): Promise<ProductFeatureControls> => {
    const desktop = await this.deps.desktopHost.status();
    const core = this.deps.coreHealth.evaluate();
    const { autoDegrade } = this.deps.getConfig().coreHealth;
    const degraded = autoDegrade && !core.healthy;
    const reason = degraded
      ? `core-degraded: ${core.checks.filter((check) => !check.ok).map((check) => check.id).join(",")}`
      : undefined;

    return {
      core: this.buildCoreView(core, autoDegrade),
      desktopAutomation: {
        available:
          desktop.online && desktop.platform === "darwin" && desktop.supportedOperations.includes("host.ui.snapshot"),
        active: !degraded,
        ...(reason ? { reason } : {}),
      },
      mcp: {
        available: this.hasConfiguredMcpServer(),
        active: !degraded,
        ...(reason ? { reason } : {}),
      },
    };
  };

  private readonly buildCoreView = (core: ReturnType<CoreHealthCheckService["evaluate"]>, autoDegrade: boolean): CoreHealthControlsView => ({
    healthy: core.healthy,
    autoDegrade,
    failedCheckIds: core.checks.filter((check) => !check.ok).map((check) => check.id),
  });

  private readonly hasConfiguredMcpServer = (): boolean =>
    Object.keys(this.deps.getConfig().mcp?.servers ?? {}).length > 0;
}

export type { ExternalFeatureState, ProductFeatureControls };
