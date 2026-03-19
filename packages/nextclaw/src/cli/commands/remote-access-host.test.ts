import { afterEach, describe, expect, it, vi } from "vitest";
import * as utils from "../utils.js";
import { RemoteAccessHost } from "./remote-access-host.js";

function createHost() {
  const serviceCommands = {
    startService: vi.fn().mockResolvedValue(undefined),
    stopService: vi.fn().mockResolvedValue(undefined),
    requestManagedServiceRestart: vi.fn().mockResolvedValue(undefined)
  };
  const host = new RemoteAccessHost({
    serviceCommands: serviceCommands as never,
    requestManagedServiceRestart: serviceCommands.requestManagedServiceRestart,
    remoteCommands: {
      getStatusView: vi.fn(),
      updateConfig: vi.fn(),
      getDoctorView: vi.fn()
    } as never,
    platformAuthCommands: {
      loginResult: vi.fn(),
      logout: vi.fn()
    } as never
  });
  return { host, serviceCommands };
}

describe("RemoteAccessHost service control", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("routes current-process restart through the managed service restart coordinator", async () => {
    vi.spyOn(utils, "readServiceState").mockReturnValue({
      pid: process.pid,
      startedAt: "2026-03-20T00:00:00.000Z",
      uiUrl: "http://127.0.0.1:19199",
      apiUrl: "http://127.0.0.1:19199/api",
      uiHost: "0.0.0.0",
      uiPort: 19199,
      logPath: "/tmp/service.log"
    });
    vi.spyOn(utils, "isProcessRunning").mockReturnValue(true);
    const { host, serviceCommands } = createHost();
    vi.spyOn(host as never, "resolveManagedUiOverrides" as never).mockReturnValue({
      enabled: true,
      host: "0.0.0.0",
      open: false,
      port: 19199
    });

    const result = await host.controlService("restart");

    expect(serviceCommands.requestManagedServiceRestart).toHaveBeenCalledWith({
      uiPort: 19199
    });
    expect(serviceCommands.stopService).not.toHaveBeenCalled();
    expect(serviceCommands.startService).not.toHaveBeenCalled();
    expect(result).toEqual({
      accepted: true,
      action: "restart",
      message: "Restart scheduled. This page may disconnect for a few seconds."
    });
  });

  it("restarts an external managed service by stopping then starting it", async () => {
    vi.spyOn(utils, "readServiceState").mockReturnValue({
      pid: process.pid + 1,
      startedAt: "2026-03-20T00:00:00.000Z",
      uiUrl: "http://127.0.0.1:19199",
      apiUrl: "http://127.0.0.1:19199/api",
      uiHost: "0.0.0.0",
      uiPort: 19199,
      logPath: "/tmp/service.log"
    });
    vi.spyOn(utils, "isProcessRunning").mockReturnValue(true);
    const { host, serviceCommands } = createHost();
    vi.spyOn(host as never, "resolveManagedUiOverrides" as never).mockReturnValue({
      enabled: true,
      host: "0.0.0.0",
      open: false,
      port: 19199
    });

    const result = await host.controlService("restart");

    expect(serviceCommands.stopService).toHaveBeenCalledOnce();
    expect(serviceCommands.startService).toHaveBeenCalledWith({
      uiOverrides: {
        enabled: true,
        host: "0.0.0.0",
        open: false,
        port: 19199
      },
      open: false
    });
    expect(serviceCommands.requestManagedServiceRestart).not.toHaveBeenCalled();
    expect(result).toEqual({
      accepted: true,
      action: "restart",
      message: "Managed service restarted."
    });
  });
});
