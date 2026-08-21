import assert from "node:assert/strict";
import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { HostIncidentStore } from "@nextclaw/core";
import { runDesktopGuardian, shouldLaunchDesktopGuardian } from "./desktop-guardian.service";

describe("Desktop guardian launch", () => {
  it("only starts the guardian for an unguarded Windows desktop process", () => {
    assert.equal(shouldLaunchDesktopGuardian({}, "win32"), true);
    assert.equal(shouldLaunchDesktopGuardian({ NEXTCLAW_DESKTOP_GUARDED: "1" }, "win32"), false);
    assert.equal(shouldLaunchDesktopGuardian({ NEXTCLAW_DESKTOP_GUARDIAN: "1" }, "win32"), false);
    assert.equal(shouldLaunchDesktopGuardian({}, "darwin"), false);
  });

  it("does not restart a child that recorded a planned exit", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nextclaw-desktop-guardian-"));
    const store = new HostIncidentStore({ rootDir: tempDir });
    let spawnCount = 0;
    try {
      await runDesktopGuardian({
        executablePath: "NextClaw Desktop.exe",
        store,
        spawnChild: (_executablePath, runId) => {
          spawnCount += 1;
          store.startRun({ runId, pid: 123, launcherVersion: "1" });
          store.recordExitIntent(runId, "user-quit");
          const child = new EventEmitter();
          queueMicrotask(() => child.emit("exit", 0, null));
          return child as unknown as ChildProcess;
        },
        delayMs: async () => {
          throw new Error("planned exit must not be restarted");
        }
      });
      assert.equal(spawnCount, 1);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
