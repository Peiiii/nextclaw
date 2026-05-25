import type { Context } from "hono";
import type { AppMetaView, BootstrapStatusView } from "@nextclaw-server/shared/types/server-api.types.js";
import { ok } from "@nextclaw-server/shared/utils/http-response.utils.js";
import type { UiRouterOptions } from "@nextclaw-server/app/types/router-options.types.js";

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

export class AppRoutesController {
  constructor(private readonly options: UiRouterOptions) {}

  readonly health = (c: Context) =>
    c.json(
      ok({
        status: "ok",
        services: {
          ncpAgent: "ready",
          cronService: this.options.cron ? "ready" : "unavailable"
        }
      })
    );

  readonly appMeta = (c: Context) => c.json(ok(buildAppMetaView(this.options)));

  readonly bootstrapStatus = (c: Context) =>
    c.json(ok(this.options.bootstrapStatus?.getStatus() ?? buildFallbackBootstrapStatus()));
}
