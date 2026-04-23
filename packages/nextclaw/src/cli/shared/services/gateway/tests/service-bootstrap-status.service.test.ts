import { describe, expect, it } from "vitest";
import { ServiceBootstrapStatusStore } from "@/cli/shared/services/gateway/service-bootstrap-status.service.js";

describe("ServiceBootstrapStatusStore", () => {
  it("tracks shell readiness and capability hydration progress", () => {
    const store = new ServiceBootstrapStatusStore();

    store.markShellReady();
    store.markNcpAgentRunning();
    store.markNcpAgentReady();
    store.markPluginHydrationRunning({ totalPluginCount: 3 });
    store.markPluginHydrationProgress({ loadedPluginCount: 2, totalPluginCount: 3 });
    store.markPluginHydrationReady({ loadedPluginCount: 3, totalPluginCount: 3 });
    store.markChannelsReady(["feishu"]);
    store.markReady();

    expect(store.getStatus()).toMatchObject({
      phase: "ready",
      ncpAgent: {
        state: "ready",
      },
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

    store.markNcpAgentRunning();
    store.markNcpAgentError("failed");
    store.markPluginHydrationRunning({ totalPluginCount: 1 });
    store.markPluginHydrationError("failed");

    expect(store.getStatus()).toMatchObject({
      phase: "error",
      ncpAgent: {
        state: "error",
        error: "failed"
      },
      pluginHydration: {
        state: "error",
        error: "failed"
      },
      channels: {
        enabled: []
      }
    });
  });

  it("keeps core readiness while plugin hydration continues in the background", () => {
    const store = new ServiceBootstrapStatusStore();

    store.markShellReady();
    store.markNcpAgentRunning();
    store.markNcpAgentReady();
    store.markReady();
    store.markPluginHydrationRunning({ totalPluginCount: 11 });
    store.markPluginHydrationProgress({ loadedPluginCount: 2 });

    expect(store.getStatus()).toMatchObject({
      phase: "ready",
      pluginHydration: {
        state: "running",
        loadedPluginCount: 2,
        totalPluginCount: 11
      }
    });
  });

  it("does not turn a core-ready app into a startup failure when background plugins fail", () => {
    const store = new ServiceBootstrapStatusStore();

    store.markNcpAgentRunning();
    store.markNcpAgentReady();
    store.markReady();
    store.markPluginHydrationRunning({ totalPluginCount: 1 });
    store.markPluginHydrationError("plugin failed");

    expect(store.getStatus()).toMatchObject({
      phase: "ready",
      pluginHydration: {
        state: "error",
        error: "plugin failed"
      }
    });
  });
});
