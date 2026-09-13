import type { Context } from "hono";
import type { AppMetaView, BootstrapStatusView } from "@nextclaw-server/shared/types/server-api.types.js";
import { ok } from "@nextclaw-server/shared/utils/http-response.utils.js";
import type { UiRouterOptions } from "@nextclaw-server/app/types/router-options.types.js";
import type { UiExtensionsView } from "@nextclaw-server/features/extensions/index.js";

function buildAppMetaView(options: UiRouterOptions): AppMetaView {
  const productVersion = options.productVersion?.trim();
  return {
    name: "NextClaw",
    productVersion: productVersion && productVersion.length > 0 ? productVersion : "0.0.0"
  };
}

function buildFallbackBootstrapStatus(): BootstrapStatusView {
  return {
    phase: "kernel-starting",
    ncpAgent: {
      state: "pending",
    },
    extensionLoading: {
      state: "pending",
      loadedExtensionCount: 0,
      totalExtensionCount: 0
    },
    channels: {
      state: "pending",
      enabled: []
    },
    remote: {
      state: "pending"
    }
  };
}

function buildExtensionsView(options: UiRouterOptions): UiExtensionsView {
  const manifests = options.kernel.extensions.getManifests();
  const statuses = options.kernel.extensions.getRuntimeStatus();
  const statusById = new Map(statuses.map((status) => [status.extensionId, status]));
  const extensions = manifests.map((manifest) => {
    const status = statusById.get(manifest.id);
    const observations = manifest.contributes?.observations;
    const channels = (manifest.contributes?.channels ?? []).map((channel) => ({
      id: channel.id,
      ...(channel.name ? { name: channel.name } : {}),
      ...(typeof channel.meta?.description === "string" ? { description: channel.meta.description } : {}),
    }));
    return {
      id: manifest.id,
      name: manifest.name?.trim() || manifest.id,
      ...(manifest.version ? { version: manifest.version } : {}),
      state: status?.state ?? "stopped",
      ...(status?.generation ? { generation: status.generation } : {}),
      ...(status?.pid ? { pid: status.pid } : {}),
      ...(status?.startedAt ? { startedAt: status.startedAt } : {}),
      leaseCount: status?.leaseReasons.length ?? 0,
      observations: {
        context: Boolean(observations?.read),
        events: Boolean(observations?.events),
      },
      channels,
    };
  });
  return {
    extensions,
    counts: {
      total: extensions.length,
      running: extensions.filter((extension) => extension.state === "running").length,
      withObservations: extensions.filter((extension) => extension.observations.context || extension.observations.events).length,
      withChannels: extensions.filter((extension) => extension.channels.length > 0).length,
    },
  };
}

export class AppRoutesController {
  constructor(private readonly options: UiRouterOptions) {}

  readonly health = (c: Context) => {
    const bootstrapStatus = this.options.bootstrapStatus?.getStatus() ?? buildFallbackBootstrapStatus();
    // /api/health 是未登录也可访问的公共路由，脱敏快照只暴露稳定 reason code，
    // 不泄露本机路径与原始异常。已鉴权面（日志、诊断面板）消费原始 evaluate()。
    const coreHealth = this.options.kernel.coreHealth?.toPublicSnapshot();
    return c.json(
      ok({
        status: "ok",
        services: {
          ncpAgent: bootstrapStatus.ncpAgent.state,
          cronService: this.options.cron ? "ready" : "unavailable"
        },
        // 自感知快照：核心部件健康与"服务器活着"是两个独立事实。
        // 检查失败不改变 200 + ok 的存活语义（代理探测/status 命令不受影响），
        // 由自修复闭环的降级（PR-2）与排查（PR-3）环节消费这份快照。
        ...(coreHealth ? { coreHealth } : {})
      })
    );
  };

  readonly appMeta = (c: Context) => c.json(ok(buildAppMetaView(this.options)));

  readonly bootstrapStatus = (c: Context) =>
    c.json(ok(this.options.bootstrapStatus?.getStatus() ?? buildFallbackBootstrapStatus()));

  readonly extensionRuntimeStatus = (c: Context) =>
    c.json(ok(this.options.kernel.extensions.getRuntimeStatus()));

  readonly extensionCatalog = (c: Context) => c.json(ok(buildExtensionsView(this.options)));
}
