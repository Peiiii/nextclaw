import { describe, expect, it } from "vitest";
import { FeatureControlsService } from "./feature-controls.service.js";
import type { FeatureControlsServiceDeps } from "./feature-controls.service.js";
import type { CoreHealthCheckService } from "@kernel/features/core-health/index.js";
import type { Config } from "@nextclaw/core";

const healthySnapshot = {
  healthy: true,
  checks: [
    { id: "config", ok: true },
    { id: "provider", ok: true },
    { id: "workspace", ok: true },
    { id: "sessions", ok: true },
  ],
} as ReturnType<CoreHealthCheckService["evaluate"]>;

const degradedSnapshot = {
  healthy: false,
  checks: [
    { id: "config", ok: true },
    { id: "provider", ok: false },
    { id: "workspace", ok: false },
    { id: "sessions", ok: true },
  ],
} as ReturnType<CoreHealthCheckService["evaluate"]>;

const darwinHost = {
  status: async () => ({
    online: true,
    platform: "darwin",
    supportedAccess: ["ui.read"],
    supportedOperations: ["host.status", "host.ui.snapshot"],
    permissions: { accessibility: "not_granted", screenCapture: "not_granted" },
  }),
} as never;

const win32Host = {
  status: async () => ({
    online: true,
    platform: "win32",
    supportedAccess: [],
    supportedOperations: ["host.status"],
    permissions: { accessibility: "not_supported", screenCapture: "not_supported" },
  }),
} as never;

const configWith = (overrides: { autoDegrade?: boolean; mcpServers?: number }): Config =>
  ({
    coreHealth: { autoDegrade: overrides.autoDegrade ?? false },
    mcp: { servers: Object.fromEntries(Array.from({ length: overrides.mcpServers ?? 0 }, (_, i) => [`srv${i}`, {}])) },
  }) as never;

const buildDeps = (overrides: {
  host?: unknown;
  snapshot?: ReturnType<CoreHealthCheckService["evaluate"]>;
  config?: Config;
}): FeatureControlsServiceDeps => ({
  desktopHost: (overrides.host ?? darwinHost) as never,
  coreHealth: { evaluate: () => overrides.snapshot ?? healthySnapshot } as never,
  getConfig: () => overrides.config ?? configWith({}),
});

describe("FeatureControlsService", () => {
  it("derives desktop availability from the backend Host contract (existing semantics)", async () => {
    const supported = new FeatureControlsService(buildDeps({}));
    const unsupported = new FeatureControlsService(buildDeps({ host: win32Host }));

    await expect(supported.get()).resolves.toEqual({
      desktopAutomation: { available: true, active: true },
      mcp: { available: false, active: true },
      core: { healthy: true, autoDegrade: false, failedCheckIds: [] },
    });
    await expect(unsupported.get()).resolves.toEqual({
      desktopAutomation: { available: false, active: true },
      mcp: { available: false, active: true },
      core: { healthy: true, autoDegrade: false, failedCheckIds: [] },
    });
  });

  it("keeps features active when autoDegrade is off even if core is unhealthy", async () => {
    const service = new FeatureControlsService(
      buildDeps({ snapshot: degradedSnapshot, config: configWith({ autoDegrade: false }) }),
    );

    const view = await service.get();
    expect(view.desktopAutomation.active).toBe(true);
    expect(view.mcp.active).toBe(true);
    expect(view.core).toEqual({ healthy: false, autoDegrade: false, failedCheckIds: ["provider", "workspace"] });
  });

  it("degrades all external features when autoDegrade is on and core is unhealthy", async () => {
    const service = new FeatureControlsService(
      buildDeps({
        snapshot: degradedSnapshot,
        config: configWith({ autoDegrade: true, mcpServers: 2 }),
      }),
    );

    const view = await service.get();
    expect(view.desktopAutomation).toEqual({ available: true, active: false, reason: "core-degraded: provider,workspace" });
    expect(view.mcp).toEqual({ available: true, active: false, reason: "core-degraded: provider,workspace" });
    expect(view.core).toEqual({ healthy: false, autoDegrade: true, failedCheckIds: ["provider", "workspace"] });
  });

  it("does not degrade when autoDegrade is on but core is healthy", async () => {
    const service = new FeatureControlsService(
      buildDeps({ snapshot: healthySnapshot, config: configWith({ autoDegrade: true }) }),
    );

    const view = await service.get();
    expect(view.desktopAutomation.active).toBe(true);
    expect(view.mcp.active).toBe(true);
    expect(view.desktopAutomation.reason).toBeUndefined();
  });
});
