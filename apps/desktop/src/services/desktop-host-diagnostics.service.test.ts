import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { HostIncidentStore } from "@nextclaw/core/host-incident";
import { DesktopHostDiagnosticsService } from "./desktop-host-diagnostics.service";

describe("DesktopHostDiagnosticsService", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nextclaw-desktop-diagnostics-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("enriches a recovered run with Windows evidence", () => {
    const store = new HostIncidentStore({ rootDir: tempDir, createId: () => "incident-1" });
    store.startRun({ runId: "run-1", pid: 1, launcherVersion: "1" });
    const logger = { info: () => undefined, warn: () => undefined, error: () => undefined };
    const service = new DesktopHostDiagnosticsService({
      logger,
      launcherVersion: "1",
      crashDumpsPath: path.join(tempDir, "dumps"),
      store,
      pid: 2,
      runId: "run-2",
      heartbeatMs: 60_000,
      collectWindowsEvidence: () => [{
        source: "windows",
        kind: "windows.system-shutdown",
        observedAt: new Date().toISOString()
      }]
    });

    const incident = service.start();

    assert.equal(incident?.reasonCode, "system-shutdown");
    assert.equal(incident?.confidence, "confirmed");
    service.dispose();
  });
});
