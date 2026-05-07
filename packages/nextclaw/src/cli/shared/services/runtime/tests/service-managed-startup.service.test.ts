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

import { spawnManagedService } from "../service-managed-startup.service.js";

describe("spawnManagedService", () => {
  let tempDir: string;
  let originalArgv: string[];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nextclaw-service-startup-"));
    originalArgv = [...process.argv];
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.argv = originalArgv;
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
        expect.stringMatching(/[/\\]tsx[/\\]dist[/\\]cli\.(mjs|js)$/),
        expect.stringMatching(/[/\\]cli[/\\]launcher[/\\]index\.(js|ts)$/),
        "serve",
        "--ui-port",
        "18791"
      ])
    );
    expect(args.some((arg) => arg === "/tmp/dist/cli/app/index.js")).toBe(false);
    expect(options).toEqual(
      expect.objectContaining({
        env: process.env,
        stdio: "ignore",
        detached: true
      })
    );
    expect(appendStartupStage).toHaveBeenCalledWith(
      path.join(tempDir, "service.log"),
      expect.stringMatching(/cli[/\\]launcher[/\\]index\.(js|ts) serve --ui-port 18791/)
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
});
