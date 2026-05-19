import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type * as ChildProcess from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextclawServiceRuntime } from "../../../service-runtime.service.js";
import { managedServiceStateStore } from "@nextclaw-service/shared/stores/managed-service-state.store.js";

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

type RelaunchRuntime = {
  armManagedServiceRelaunch: (params: {
    reason: string;
    strategy: "background-service-or-exit";
  }) => void;
};

function readHelperScript(): string {
  const calls = mocks.spawn.mock.calls as unknown as Array<[unknown, string[]]>;
  return String(calls[0]?.[1]?.[1] ?? "");
}

describe("NextclawServiceRuntime self relaunch", () => {
  let tempHome = "";
  let originalHome: string | undefined;
  let originalArgv: string[];

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "nextclaw-service-runtime-test-"));
    originalHome = process.env.NEXTCLAW_HOME;
    originalArgv = [...process.argv];
    process.env.NEXTCLAW_HOME = tempHome;
    mocks.spawn.mockClear();
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
    process.argv = originalArgv;
    if (originalHome === undefined) {
      delete process.env.NEXTCLAW_HOME;
    } else {
      process.env.NEXTCLAW_HOME = originalHome;
    }
    rmSync(tempHome, { recursive: true, force: true });
  });

  it("relaunches through the current CLI app entry instead of the service package index", () => {
    process.argv[1] = "/pkg/runtime/dist/cli/app/index.js";
    const runtime = new NextclawServiceRuntime({ logo: "test" }) as unknown as RelaunchRuntime;

    runtime.armManagedServiceRelaunch({
      reason: "runtime update apply",
      strategy: "background-service-or-exit"
    });

    const helperScript = readHelperScript();
    expect(helperScript).toContain("/pkg/runtime/dist/cli/app/index.js");
    expect(helperScript).toContain('"start","--ui-port","19199"');
    expect(helperScript).not.toContain("@nextclaw/service/dist/index.js");
  });

  it("preserves tsx launch arguments for source CLI entries", () => {
    process.argv[1] = "/repo/packages/nextclaw/src/cli/app/index.ts";
    const runtime = new NextclawServiceRuntime({ logo: "test" }) as unknown as RelaunchRuntime;

    runtime.armManagedServiceRelaunch({
      reason: "runtime update apply",
      strategy: "background-service-or-exit"
    });

    const helperScript = readHelperScript();
    expect(helperScript).toContain("tsx");
    expect(helperScript).toContain("/repo/packages/nextclaw/src/cli/app/index.ts");
    expect(helperScript).toContain('"start","--ui-port","19199"');
  });
});
