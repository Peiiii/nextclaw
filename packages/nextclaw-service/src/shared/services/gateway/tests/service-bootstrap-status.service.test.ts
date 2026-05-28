import { describe, expect, it } from "vitest";
import { createUiRouter } from "@nextclaw/server";
import { EventBus } from "@nextclaw/shared";
import { ServiceBootstrapStatusStore } from "../service-bootstrap-status.service.js";

describe("ServiceBootstrapStatusStore", () => {
  it("tracks shell readiness and capability hydration progress", () => {
    const store = new ServiceBootstrapStatusStore();

    store.markShellReady();
    store.markNcpAgentRunning();
    store.markNcpAgentReady();
    store.markExtensionLoadingRunning({ totalExtensionCount: 3 });
    store.markExtensionLoadingProgress({ loadedExtensionCount: 2, totalExtensionCount: 3 });
    store.markExtensionLoadingReady({ loadedExtensionCount: 3, totalExtensionCount: 3 });
    store.markChannelsReady(["feishu"]);

    expect(store.getStatus()).toMatchObject({
      phase: "ready",
      ncpAgent: {
        state: "ready",
      },
      extensionLoading: {
        state: "ready",
        loadedExtensionCount: 3,
        totalExtensionCount: 3
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
    store.markExtensionLoadingRunning({ totalExtensionCount: 1 });
    store.markExtensionLoadingError("failed");

    expect(store.getStatus()).toMatchObject({
      phase: "error",
      ncpAgent: {
        state: "error",
        error: "failed"
      },
      extensionLoading: {
        state: "error",
        error: "failed"
      },
      channels: {
        enabled: []
      }
    });
  });

  it("syncs remote runtime state into the bootstrap view", () => {
    const store = new ServiceBootstrapStatusStore();

    store.syncRemoteRuntimeState({
      enabled: true,
      mode: "service",
      state: "connected",
      updatedAt: "2026-03-24T00:00:00.000Z"
    });
    expect(store.getStatus().remote).toEqual({ state: "ready" });

    store.syncRemoteRuntimeState({
      enabled: true,
      mode: "service",
      state: "error",
      lastError: "Remote access is already owned by running NextClaw service PID 1000.",
      updatedAt: "2026-03-24T00:00:01.000Z"
    });
    expect(store.getStatus().remote).toEqual({
      state: "conflict",
      message: "Remote access is already owned by running NextClaw service PID 1000."
    });
  });

  it("returns the synced remote runtime state through the bootstrap API route", async () => {
    const store = new ServiceBootstrapStatusStore();
    store.markShellReady();
    store.markNcpAgentReady();
    store.markExtensionLoadingReady({ loadedExtensionCount: 1, totalExtensionCount: 1 });
    store.markChannelsReady([]);
    store.syncRemoteRuntimeState({
      enabled: true,
      mode: "service",
      state: "connected",
      updatedAt: "2026-03-24T00:00:00.000Z"
    });

    const app = createUiRouter({
      kernel: {
        agentRuntimeManager: {},
        assetStore: {},
        ingress: {},
        llmProviders: {},
        sessionManager: {},
        sessionRunManager: {},
      } as never,
      configPath: "/tmp/nextclaw-bootstrap-status-route-test.json",
      appEventBus: new EventBus(),
      bootstrapStatus: store
    });
    const response = await app.request("http://localhost/api/runtime/bootstrap-status");
    const payload = await response.json() as { ok: true; data: { remote: { state: string } } };

    expect(response.status).toBe(200);
    expect(payload.data.remote.state).toBe("ready");
  });
});
