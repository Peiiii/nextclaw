import { afterEach, describe, expect, it, vi } from "vitest";
import * as utils from "../../shared/utils/cli.utils.js";
import { localUiRuntimeStore } from "../../shared/stores/local-ui-runtime.store.js";
import { managedServiceStateStore } from "../../shared/stores/managed-service-state.store.js";
import { readCurrentNextclawRemoteRuntimeState } from "./remote-runtime-support.js";

describe("readCurrentNextclawRemoteRuntimeState", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("downgrades stale managed service runtime from connected to disconnected", () => {
    vi.spyOn(localUiRuntimeStore, "read").mockReturnValue(null);
    vi.spyOn(managedServiceStateStore, "read").mockReturnValue({
      pid: 4242,
      startedAt: "2026-03-22T00:00:00.000Z",
      uiUrl: "http://127.0.0.1:18791",
      apiUrl: "http://127.0.0.1:18791/api",
      uiHost: "0.0.0.0",
      uiPort: 18791,
      logPath: "/tmp/service.log",
      remote: {
        enabled: true,
        mode: "service",
        state: "connected",
        deviceId: "device-1",
        deviceName: "demo",
        platformBase: "https://ai-gateway-api.nextclaw.io",
        localOrigin: "http://127.0.0.1:18791",
        lastConnectedAt: "2026-03-22T00:00:00.000Z",
        lastError: null,
        updatedAt: "2026-03-22T00:00:00.000Z"
      }
    });
    vi.spyOn(utils, "isProcessRunning").mockReturnValue(false);

    const state = readCurrentNextclawRemoteRuntimeState();

    expect(state).toMatchObject({
      enabled: true,
      mode: "service",
      state: "disconnected",
      deviceId: "device-1",
      lastError: "Managed service is not running."
    });
    expect(state?.updatedAt).not.toBe("2026-03-22T00:00:00.000Z");
  });

  it("keeps live managed service runtime unchanged", () => {
    vi.spyOn(localUiRuntimeStore, "read").mockReturnValue(null);
    vi.spyOn(managedServiceStateStore, "read").mockReturnValue({
      pid: 4242,
      startedAt: "2026-03-22T00:00:00.000Z",
      uiUrl: "http://127.0.0.1:18791",
      apiUrl: "http://127.0.0.1:18791/api",
      uiHost: "0.0.0.0",
      uiPort: 18791,
      logPath: "/tmp/service.log",
      remote: {
        enabled: true,
        mode: "service",
        state: "connected",
        deviceId: "device-1",
        deviceName: "demo",
        platformBase: "https://ai-gateway-api.nextclaw.io",
        localOrigin: "http://127.0.0.1:18791",
        lastConnectedAt: "2026-03-22T00:00:00.000Z",
        lastError: null,
        updatedAt: "2026-03-22T00:00:00.000Z"
      }
    });
    vi.spyOn(utils, "isProcessRunning").mockReturnValue(true);

    const state = readCurrentNextclawRemoteRuntimeState();

    expect(state).toMatchObject({
      enabled: true,
      mode: "service",
      state: "connected",
      lastError: null,
      updatedAt: "2026-03-22T00:00:00.000Z"
    });
  });

  it("reads live foreground ui runtime state without requiring managed service state", () => {
    vi.spyOn(localUiRuntimeStore, "read").mockReturnValue({
      pid: 18792,
      startedAt: "2026-03-22T00:00:00.000Z",
      uiUrl: "http://127.0.0.1:18792",
      apiUrl: "http://127.0.0.1:18792/api",
      uiHost: "0.0.0.0",
      uiPort: 18792,
      remote: {
        enabled: true,
        mode: "foreground",
        state: "connected",
        deviceId: "device-foreground",
        deviceName: "demo-dev",
        platformBase: "https://ai-gateway-api.nextclaw.io",
        localOrigin: "http://127.0.0.1:18792",
        lastConnectedAt: "2026-03-22T00:00:00.000Z",
        lastError: null,
        updatedAt: "2026-03-22T00:00:00.000Z"
      }
    });
    vi.spyOn(managedServiceStateStore, "read").mockReturnValue(null);
    vi.spyOn(utils, "isProcessRunning").mockReturnValue(true);

    const state = readCurrentNextclawRemoteRuntimeState();

    expect(state).toMatchObject({
      enabled: true,
      mode: "foreground",
      state: "connected",
      deviceId: "device-foreground",
      lastError: null
    });
  });
});
