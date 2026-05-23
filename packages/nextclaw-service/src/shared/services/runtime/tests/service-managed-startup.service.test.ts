import type * as ChildProcessModule from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ManagedServiceState, ManagedServiceStateStore } from "@nextclaw-service/shared/stores/managed-service-state.store.js";

const spawnMock = vi.hoisted(() => vi.fn(() => ({ pid: 4321 })));
const writeInitialManagedServiceStateMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof ChildProcessModule>();
  return {
    ...actual,
    spawn: spawnMock
  };
});

vi.mock("@nextclaw-service/shared/services/runtime/utils/service-remote-runtime.utils.js", () => ({
  writeInitialManagedServiceState: writeInitialManagedServiceStateMock
}));

import { ManagedServiceSupervisor } from "../managed-service-supervisor.service.js";
import { resolveManagedServiceReadySnapshot } from "../service-managed-startup.service.js";

function createStateStore(initialState: ManagedServiceState | null): ManagedServiceStateStore {
  let state = initialState;
  return {
    get path() {
      return "/tmp/service.json";
    },
    read: () => state,
    write: (next) => {
      state = next;
    },
    update: (updater) => {
      if (!state) {
        return null;
      }
      state = updater(state);
      return state;
    },
    clear: () => {
      state = null;
    },
    clearIfOwnedByProcess: (pid = process.pid) => {
      if (state?.pid === pid) {
        state = null;
      }
    }
  } as ManagedServiceStateStore;
}

describe("spawnManagedService", () => {
  let tempDir: string;
  let originalArgv: string[];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nextclaw-service-startup-"));
    originalArgv = [...process.argv];
    process.env.NEXTCLAW_RUNTIME_BUNDLE_CHILD = "1";
    process.env.NEXTCLAW_DISABLE_RUNTIME_BUNDLE_LAUNCHER = "1";
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.argv = originalArgv;
    delete process.env.NEXTCLAW_RUNTIME_BUNDLE_CHILD;
    delete process.env.NEXTCLAW_DISABLE_RUNTIME_BUNDLE_LAUNCHER;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("spawns the managed service through the resolved CLI entry", () => {
    process.argv[1] = "/tmp/dist/cli/app/index.js";
    const appendStartupStage = vi.fn();
    const supervisor = new ManagedServiceSupervisor({
      now: () => new Date("2026-05-23T00:00:00.000Z")
    });

    const startup = supervisor.spawnManagedService({
      appName: "nextclaw",
      config: {
        remote: {
          enabled: false
        }
      } as never,
      uiConfig: {
        host: "0.0.0.0",
        port: 18791
      },
      uiUrl: "http://127.0.0.1:18791",
      apiUrl: "http://127.0.0.1:18791/api",
      healthUrl: "http://127.0.0.1:18791/api/health",
      resolveStartupTimeoutMs: () => 33_000,
      appendStartupStage,
      printStartupFailureDiagnostics: vi.fn(),
      resolveServiceLogPath: () => path.join(tempDir, "service.log")
    });

    expect(startup?.snapshot.pid).toBe(4321);
    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [command, args, options] = spawnMock.mock.calls[0] as unknown as [string, string[], Record<string, unknown>];
    expect(command).toBe(process.execPath);
    expect(args).toEqual(
      expect.arrayContaining([
        "/tmp/dist/cli/app/index.js",
        "serve",
        "--ui-port",
        "18791"
      ])
    );
    expect(options).toEqual(
      expect.objectContaining({
        env: expect.objectContaining({
          PATH: expect.any(String)
        }),
        stdio: "ignore",
        detached: true,
        windowsHide: true
      })
    );
    expect((options.env as NodeJS.ProcessEnv).NEXTCLAW_RUNTIME_BUNDLE_CHILD).toBeUndefined();
    expect((options.env as NodeJS.ProcessEnv).NEXTCLAW_DISABLE_RUNTIME_BUNDLE_LAUNCHER).toBeUndefined();
    expect(appendStartupStage).toHaveBeenCalledWith(
      path.join(tempDir, "service.log"),
      expect.stringMatching(/cli[/\\]app[/\\]index\.js serve --ui-port 18791/)
    );
    expect(writeInitialManagedServiceStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        readinessTimeoutMs: 33_000,
        lease: expect.objectContaining({
          ownerPid: 4321,
          heartbeatAt: "2026-05-23T00:00:00.000Z"
        }),
        snapshot: expect.objectContaining({
          pid: 4321,
          uiPort: 18791
        })
      })
    );
  });

  it("tracks the ready runtime child pid when the local UI runtime matches the managed port", () => {
    const readySnapshot = resolveManagedServiceReadySnapshot({
      snapshot: {
        pid: 4321,
        uiUrl: "http://127.0.0.1:18791",
        apiUrl: "http://127.0.0.1:18791/api",
        uiHost: "0.0.0.0",
        uiPort: 18791,
        logPath: path.join(tempDir, "service.log")
      },
      readLocalUiRuntimeState: () => ({
        pid: 6789,
        startedAt: "2026-05-07T00:00:00.000Z",
        uiUrl: "http://127.0.0.1:18791",
        apiUrl: "http://127.0.0.1:18791/api",
        uiHost: "0.0.0.0",
        uiPort: 18791
      }),
      isProcessRunningFn: (pid) => pid === 6789
    });

    expect(readySnapshot).toEqual({
      pid: 6789,
      uiUrl: "http://127.0.0.1:18791",
      apiUrl: "http://127.0.0.1:18791/api",
      uiHost: "0.0.0.0",
      uiPort: 18791,
      logPath: path.join(tempDir, "service.log")
    });
  });

  it("keeps the launcher snapshot when the local UI runtime does not match the managed port", () => {
    const snapshot = {
      pid: 4321,
      uiUrl: "http://127.0.0.1:18791",
      apiUrl: "http://127.0.0.1:18791/api",
      uiHost: "0.0.0.0",
      uiPort: 18791,
      logPath: path.join(tempDir, "service.log")
    };

    const readySnapshot = resolveManagedServiceReadySnapshot({
      snapshot,
      readLocalUiRuntimeState: () => ({
        pid: 6789,
        startedAt: "2026-05-07T00:00:00.000Z",
        uiUrl: "http://127.0.0.1:18870",
        apiUrl: "http://127.0.0.1:18870/api",
        uiHost: "0.0.0.0",
        uiPort: 18870
      }),
      isProcessRunningFn: () => true
    });

    expect(readySnapshot).toEqual(snapshot);
  });
});

describe("ManagedServiceSupervisor lifecycle", () => {
  it("marks a live process stale when its lease expires", () => {
    const state: ManagedServiceState = {
      pid: 4321,
      startedAt: "2026-05-23T00:00:00.000Z",
      uiUrl: "http://127.0.0.1:18791",
      apiUrl: "http://127.0.0.1:18791/api",
      logPath: "/tmp/service.log",
      lease: {
        ownerPid: 4321,
        heartbeatAt: "2026-05-23T00:00:00.000Z",
        heartbeatIntervalMs: 1000,
        ttlMs: 2000
      }
    };
    const supervisor = new ManagedServiceSupervisor({
      isProcessRunningFn: (pid) => pid === 4321,
      now: () => new Date("2026-05-23T00:00:03.001Z")
    });

    expect(supervisor.resolveStateLiveness(state)).toMatchObject({
      processExists: true,
      running: false,
      staleState: true,
      staleReason: "lease-expired",
      leaseExpired: true,
      lastHeartbeatAt: "2026-05-23T00:00:00.000Z"
    });
  });

  it("marks a live process stale when its lease heartbeat is invalid", () => {
    const state: ManagedServiceState = {
      pid: 4321,
      startedAt: "2026-05-23T00:00:00.000Z",
      uiUrl: "http://127.0.0.1:18791",
      apiUrl: "http://127.0.0.1:18791/api",
      logPath: "/tmp/service.log",
      lease: {
        ownerPid: 4321,
        heartbeatAt: "not-a-date",
        heartbeatIntervalMs: 1000,
        ttlMs: 2000
      }
    };
    const supervisor = new ManagedServiceSupervisor({
      isProcessRunningFn: (pid) => pid === 4321,
      now: () => new Date("2026-05-23T00:00:03.001Z")
    });

    expect(supervisor.resolveStateLiveness(state)).toMatchObject({
      processExists: true,
      running: false,
      staleState: true,
      staleReason: "lease-expired",
      leaseExpired: true,
      lastHeartbeatAt: "not-a-date"
    });
  });

  it("updates heartbeat only when the current process owns the service state", () => {
    const store = createStateStore({
      pid: 4321,
      startedAt: "2026-05-23T00:00:00.000Z",
      uiUrl: "http://127.0.0.1:18791",
      apiUrl: "http://127.0.0.1:18791/api",
      logPath: "/tmp/service.log"
    });
    const supervisor = new ManagedServiceSupervisor({
      stateStore: store,
      now: () => new Date("2026-05-23T00:00:01.000Z")
    });

    supervisor.startHeartbeatForCurrentProcess(4321);

    expect(store.read()?.lease).toMatchObject({
      ownerPid: 4321,
      heartbeatAt: "2026-05-23T00:00:01.000Z"
    });
    supervisor.stopHeartbeatForCurrentProcess();
  });

  it("records the last observed exit for the owning process", () => {
    const store = createStateStore({
      pid: 4321,
      startedAt: "2026-05-23T00:00:00.000Z",
      uiUrl: "http://127.0.0.1:18791",
      apiUrl: "http://127.0.0.1:18791/api",
      logPath: "/tmp/service.log"
    });
    const supervisor = new ManagedServiceSupervisor({ stateStore: store });

    supervisor.recordCurrentProcessExit({
      pid: 4321,
      reason: "signal",
      signal: "SIGTERM",
      code: 143,
      exitedAt: "2026-05-23T00:00:02.000Z"
    });

    expect(store.read()?.lastExit).toEqual({
      pid: 4321,
      reason: "signal",
      signal: "SIGTERM",
      code: 143,
      exitedAt: "2026-05-23T00:00:02.000Z"
    });
  });
});
