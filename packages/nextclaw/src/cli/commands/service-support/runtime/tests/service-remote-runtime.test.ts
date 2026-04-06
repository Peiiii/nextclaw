import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ServiceState } from "../../../../utils.js";
import {
  claimManagedRemoteRuntimeOwnership,
  createManagedRemoteModuleForUi
} from "../service-remote-runtime.js";

describe("claimManagedRemoteRuntimeOwnership", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fails explicitly when another managed service already owns remote access", () => {
    const claim = claimManagedRemoteRuntimeOwnership({
      localOrigin: "http://127.0.0.1:18792",
      currentPid: 2000,
      isProcessRunningFn: () => true,
      readServiceStateFn: () =>
        ({
          pid: 1000,
          startedAt: "2026-03-24T00:00:00.000Z",
          uiUrl: "http://127.0.0.1:9808",
          apiUrl: "http://127.0.0.1:9808/api",
          uiHost: "0.0.0.0",
          uiPort: 9808,
          logPath: "/tmp/nextclaw-service.log",
          remote: {
            enabled: true,
            mode: "service",
            state: "connected",
            localOrigin: "http://127.0.0.1:9808",
            updatedAt: "2026-03-24T00:00:00.000Z"
          }
        }) satisfies ServiceState
    });

    expect(claim.ok).toBe(false);
    expect(claim.ok ? "" : claim.error).toContain("running NextClaw service PID 1000");
    expect(claim.ok ? "" : claim.error).toContain("http://127.0.0.1:9808");
  });

  it("reclaims a stale local ownership lock and releases it after use", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nextclaw-remote-owner-"));
    const lockPath = path.join(tempDir, "remote-owner.lock.json");

    fs.writeFileSync(
      lockPath,
      JSON.stringify({
        pid: 1234,
        localOrigin: "http://127.0.0.1:9808",
        claimedAt: "2026-03-24T00:00:00.000Z"
      }),
      "utf-8"
    );

    const claim = claimManagedRemoteRuntimeOwnership({
      localOrigin: "http://127.0.0.1:18792",
      lockPath,
      currentPid: 5678,
      now: () => "2026-03-24T01:00:00.000Z",
      isProcessRunningFn: () => false,
      readServiceStateFn: () => null
    });

    expect(claim.ok).toBe(true);
    if (!claim.ok) {
      return;
    }

    const stored = JSON.parse(fs.readFileSync(lockPath, "utf-8")) as {
      pid: number;
      localOrigin: string;
    };
    expect(stored).toMatchObject({
      pid: 5678,
      localOrigin: "http://127.0.0.1:18792"
    });

    claim.release();
    expect(fs.existsSync(lockPath)).toBe(false);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});

describe("createManagedRemoteModuleForUi", () => {
  it("prefers the explicit local origin override when provided", async () => {
    const runCalls: Array<{ localOrigin: string }> = [];
    const module = createManagedRemoteModuleForUi({
      loadConfig: () =>
        ({
          remote: {
            enabled: true,
            autoReconnect: true,
            deviceName: "dev-box",
            platformApiBase: "https://platform.example.com"
          }
        }) as never,
      uiConfig: {
        enabled: true,
        host: "0.0.0.0",
        port: 18792
      },
      localOriginOverride: "http://127.0.0.1:5174/"
    });

    expect(module).not.toBeNull();
    if (!module) {
      return;
    }

    (module as unknown as {
      deps: {
        createConnector: (logger: { info: (message: string) => void; warn: (message: string) => void; error: (message: string) => void }) => {
          run: (options: { localOrigin: string }) => Promise<void>;
        };
        claimOwnership?: () => { ok: true; release: () => void };
      };
    }).deps.createConnector = () => ({
      run: async (options) => {
        runCalls.push({ localOrigin: options.localOrigin });
      }
    });
    (module as unknown as {
      deps: {
        claimOwnership?: () => { ok: true; release: () => void };
      };
    }).deps.claimOwnership = () => ({ ok: true, release: () => undefined });

    module.start();
    await vi.waitFor(() => {
      expect(runCalls).toEqual([{ localOrigin: "http://127.0.0.1:5174" }]);
    });
  });
});
