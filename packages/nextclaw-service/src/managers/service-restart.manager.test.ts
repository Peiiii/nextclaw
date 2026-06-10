import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type * as ChildProcess from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ManagedServiceManager } from "@nextclaw-service/managers/managed-service.manager.js";
import { ServiceRestartManager } from "@nextclaw-service/managers/service-restart.manager.js";
import { managedServiceStateStore } from "@nextclaw-service/stores/managed-service-state.store.js";

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(() => ({ unref: vi.fn() }))
}));

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof ChildProcess>();
  return {
    ...actual,
    spawn: mocks.spawn
  };
});

function readHelperScript(): string {
  const calls = mocks.spawn.mock.calls as unknown as Array<[unknown, string[]]>;
  return String(calls[0]?.[1]?.[1] ?? "");
}

describe("ServiceRestartManager self relaunch", () => {
  let tempHome = "";
  let originalHome: string | undefined;
  let originalArgv: string[];
  let restartManager: ServiceRestartManager;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "nextclaw-service-runtime-test-"));
    originalHome = process.env.NEXTCLAW_HOME;
    originalArgv = [...process.argv];
    process.env.NEXTCLAW_HOME = tempHome;
    vi.useFakeTimers();
    mocks.spawn.mockClear();
    restartManager = new ServiceRestartManager({
      managedService: {} as ManagedServiceManager
    });
    managedServiceStateStore.write({
      pid: process.pid,
      startedAt: "2026-05-19T00:00:00.000Z",
      uiUrl: "http://127.0.0.1:19199",
      apiUrl: "http://127.0.0.1:19199/api",
      uiHost: "0.0.0.0",
      uiPort: 19199,
      logPath: join(tempHome, "logs", "service.log")
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    process.argv = originalArgv;
    if (originalHome === undefined) {
      delete process.env.NEXTCLAW_HOME;
    } else {
      process.env.NEXTCLAW_HOME = originalHome;
    }
    rmSync(tempHome, { recursive: true, force: true });
  });

  it("relaunches through the current CLI app entry instead of the service package index", async () => {
    process.argv[1] = "/pkg/runtime/dist/cli/app/index.js";
    await restartManager.requestRestart({
      reason: "runtime update apply",
      manualMessage: "Restart the gateway to apply changes.",
      strategy: "background-service-or-exit",
      delayMs: 100_000
    });

    const helperScript = readHelperScript();
    expect(helperScript).toContain("/pkg/runtime/dist/cli/app/index.js");
    expect(helperScript).toContain('"start","--ui-port","19199"');
    expect(helperScript).not.toContain("@nextclaw/service/dist/index.js");
  });

  it("preserves tsx launch arguments for source CLI entries", async () => {
    process.argv[1] = "/repo/packages/nextclaw/src/cli/app/index.ts";
    await restartManager.requestRestart({
      reason: "runtime update apply",
      manualMessage: "Restart the gateway to apply changes.",
      strategy: "background-service-or-exit",
      delayMs: 100_000
    });

    const helperScript = readHelperScript();
    expect(helperScript).toContain("tsx");
    expect(helperScript).toContain("/repo/packages/nextclaw/src/cli/app/index.ts");
    expect(helperScript).toContain('"start","--ui-port","19199"');
  });
});
