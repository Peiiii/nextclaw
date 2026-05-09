import type * as ChildProcessModule from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.hoisted(() => vi.fn(() => ({ pid: 4321 })));
const writeInitialManagedServiceStateMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof ChildProcessModule>();
  return {
    ...actual,
    spawn: spawnMock
  };
});

vi.mock("../service-remote-runtime.service.js", () => ({
  writeInitialManagedServiceState: writeInitialManagedServiceStateMock
}));

import { resolveManagedServiceReadySnapshot, spawnManagedService } from "../service-managed-startup.service.js";

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

    const startup = spawnManagedService({
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
        detached: true
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
