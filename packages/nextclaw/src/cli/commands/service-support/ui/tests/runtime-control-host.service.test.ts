import { beforeEach, describe, expect, it, vi } from "vitest";
import { RuntimeControlHost } from "../runtime-control-host.service.js";
import { pendingRestartStore } from "../../../../runtime-state/pending-restart.store.js";

const mocks = vi.hoisted(() => ({
  controlRemoteService: vi.fn(),
  resolveRemoteServiceView: vi.fn(),
  requestManagedServiceRestart: vi.fn()
}));

vi.mock("../../../remote-support/remote-access-service-control.js", () => ({
  controlRemoteService: (...args: unknown[]) => mocks.controlRemoteService(...args),
  resolveRemoteServiceView: (...args: unknown[]) => mocks.resolveRemoteServiceView(...args)
}));

vi.mock("../service-remote-access.service.js", () => ({
  requestManagedServiceRestart: (...args: unknown[]) => mocks.requestManagedServiceRestart(...args)
}));

describe("RuntimeControlHost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pendingRestartStore.clear();
    mocks.resolveRemoteServiceView.mockReturnValue({
      running: true,
      currentProcess: true,
      pid: process.pid,
      uiUrl: "http://127.0.0.1:55667",
      uiPort: 55667
    });
    mocks.controlRemoteService.mockResolvedValue({
      accepted: true,
      action: "restart",
      message: "Managed service restarted."
    });
  });

  it("describes managed local service control capabilities", () => {
    const host = new RuntimeControlHost({
      serviceCommands: {
        startService: vi.fn(),
        stopService: vi.fn()
      },
      requestRestart: vi.fn(),
      uiConfig: { host: "0.0.0.0", port: 55667 }
    });

    const view = host.getControl();
    expect(view.environment).toBe("managed-local-service");
    expect(view.serviceState).toBe("running");
    expect(view.canStartService.available).toBe(false);
    expect(view.canRestartService.available).toBe(true);
    expect(view.canStopService.available).toBe(true);
    expect(view.canRestartApp.available).toBe(false);
    expect(view.pendingRestart).toBeNull();
  });

  it("exposes pending restart reasons without auto-restarting", () => {
    pendingRestartStore.mark({
      changedPaths: ["plugins"],
      manualMessage: "Saved changes are waiting for a manual restart.",
      reason: "plugin install"
    });

    const host = new RuntimeControlHost({
      serviceCommands: {
        startService: vi.fn(),
        stopService: vi.fn()
      },
      requestRestart: vi.fn(),
      uiConfig: { host: "0.0.0.0", port: 55667 }
    });

    const view = host.getControl();
    expect(view.pendingRestart).toMatchObject({
      changedPaths: ["plugins"],
      message: "Saved changes are waiting for a manual restart."
    });
    expect(view.message).toBe("Use this page to manage the local NextClaw service. Closing the browser does not stop the service.");
  });

  it("maps service actions through the shared managed-service owner", async () => {
    const host = new RuntimeControlHost({
      serviceCommands: {
        startService: vi.fn(),
        stopService: vi.fn()
      },
      requestRestart: vi.fn(),
      uiConfig: { host: "0.0.0.0", port: 55667 }
    });

    mocks.controlRemoteService
      .mockResolvedValueOnce({
        accepted: true,
        action: "start",
        message: "Managed service started."
      })
      .mockResolvedValueOnce({
        accepted: true,
        action: "restart",
        message: "Managed service restarted."
      })
      .mockResolvedValueOnce({
        accepted: true,
        action: "stop",
        message: "Managed service stopped."
      });

    await expect(host.startService()).resolves.toMatchObject({
      action: "start-service",
      lifecycle: "starting-service",
      message: "Managed service started."
    });
    await expect(host.restartService()).resolves.toMatchObject({
      action: "restart-service",
      lifecycle: "restarting-service",
      message: "Managed service restarted."
    });
    await expect(host.stopService()).resolves.toMatchObject({
      action: "stop-service",
      lifecycle: "stopping-service",
      message: "Managed service stopped."
    });

    expect(mocks.controlRemoteService).toHaveBeenNthCalledWith(1, "start", expect.any(Object));
    expect(mocks.controlRemoteService).toHaveBeenNthCalledWith(2, "restart", expect.any(Object));
    expect(mocks.controlRemoteService).toHaveBeenNthCalledWith(3, "stop", expect.any(Object));
  });
});
