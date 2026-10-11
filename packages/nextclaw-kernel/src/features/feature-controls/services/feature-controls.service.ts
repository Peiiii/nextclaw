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
    // 纯同步的核心健康判断面：不调用 Desktop，避免 Desktop 超时/异常连带阻断 MCP 工具枚举。
    const coreSync = this.deps.coreHealth.evaluate();
    const { autoDegrade } = this.deps.getConfig().coreHealth;
    const degraded = autoDegrade && !coreSync.healthy;
    const reason = degraded
      ? `core-degraded: ${coreSync.checks.filter((check) => !check.ok).map((check) => check.id).join(",")}`
      : undefined;

    // Desktop 状态单独求值：异常时降为 available=false + 稳定 reason，
    // 不向其它 ToolProvider 传播失败——保住最小核心。
    let desktop: { online: boolean; platform: string; supportedOperations: string[] };
    try {
      desktop = await this.deps.desktopHost.status();
    } catch {
      desktop = { online: false, platform: "unknown", supportedOperations: [] };
    }

    const desktopAvailable =
      desktop.online && desktop.platform === "darwin" && desktop.supportedOperations.includes("host.ui.snapshot");
    const mcpAvailable = this.hasConfiguredMcpServer();

    return {
      core: this.buildCoreView(coreSync, autoDegrade),
      desktopAutomation: {
        available: desktopAvailable,
        // 契约定义 active 为"现在真的可用"：必须同时满足平台可用（available）且未进入降级（!degraded）。
        // 修前 `active = !degraded` 会在 available=false、degraded=false 时产出矛盾值（如 Windows 平台 active=true）。
        active: desktopAvailable && !degraded,
        ...(reason ? { reason } : {}),
      },
      mcp: {
        available: mcpAvailable,
        active: mcpAvailable && !degraded,
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
