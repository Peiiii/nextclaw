import type { Context } from "hono";
import type { AppMetaView, BootstrapStatusView } from "../types.js";
import { ok } from "./response.js";
import type { UiRouterOptions } from "./types.js";

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
    pluginHydration: {
      state: "pending",
      loadedPluginCount: 0,
      totalPluginCount: 0
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
          ncpAgent: this.options.ncpAgent ? "ready" : "unavailable",
          cronService: this.options.cronService ? "ready" : "unavailable"
        }
      })
    );

  readonly appMeta = (c: Context) => c.json(ok(buildAppMetaView(this.options)));

  readonly bootstrapStatus = (c: Context) =>
    c.json(ok(this.options.getBootstrapStatus?.() ?? buildFallbackBootstrapStatus()));
}
