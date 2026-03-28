import { describe, expect, it } from "vitest";
import { ServiceBootstrapStatusStore } from "./service-bootstrap-status.js";

describe("ServiceBootstrapStatusStore", () => {
  it("tracks shell readiness and capability hydration progress", () => {
    const store = new ServiceBootstrapStatusStore();

    store.markShellReady();
    store.markPluginHydrationRunning({ totalPluginCount: 3 });
    store.markPluginHydrationProgress({ loadedPluginCount: 2, totalPluginCount: 3 });
    store.markPluginHydrationReady({ loadedPluginCount: 3, totalPluginCount: 3 });
    store.markChannelsReady(["feishu"]);
    store.markReady();

    expect(store.getStatus()).toMatchObject({
      phase: "ready",
      pluginHydration: {
        state: "ready",
        loadedPluginCount: 3,
        totalPluginCount: 3
      },
      channels: {
        state: "ready",
        enabled: ["feishu"]
      }
    });
  });

  it("tracks hydration failure without mutating returned snapshots", () => {
    const store = new ServiceBootstrapStatusStore();
    const firstSnapshot = store.getStatus();
    firstSnapshot.channels.enabled.push("mutated");

    store.markPluginHydrationRunning({ totalPluginCount: 1 });
    store.markPluginHydrationError("failed");

    expect(store.getStatus()).toMatchObject({
      phase: "error",
      pluginHydration: {
        state: "error",
        error: "failed"
      },
      channels: {
        enabled: []
      }
    });
  });
});
