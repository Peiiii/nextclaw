import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HostIncidentStore } from "./host-incident.service.js";

describe("HostIncidentStore", () => {
  let tempDir: string;
  let now: Date;
  let sequence = 0;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nextclaw-host-incident-"));
    now = new Date("2026-08-22T10:00:00.000Z");
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const createStore = () => new HostIncidentStore({
    rootDir: tempDir,
    now: () => now,
    createId: () => `incident-${++sequence}`
  });

  it("recovers an unfinished run as a suspected external termination when guardian observed it", () => {
    const store = createStore();
    const first = store.startRun({ runId: "run-1", pid: 101, launcherVersion: "1.0.0" });
    store.recordRunEvidence(first.run.runId, {
      source: "guardian",
      kind: "guardian.main-exited",
      observedAt: now.toISOString(),
      facts: { code: 1 }
    });
    now = new Date("2026-08-22T10:01:00.000Z");

    const next = store.startRun({ runId: "run-2", pid: 102, launcherVersion: "1.0.0" });

    expect(next.recoveredIncident).toMatchObject({
      runId: "run-1",
      reasonCode: "external-termination-suspected",
      confidence: "suspected",
      expected: false
    });
    expect(store.getLatestIncident({ unresolvedOnly: true })?.incidentId).toBe(next.recoveredIncident?.incidentId);
  });

  it("does not create an incident for a completed planned exit", () => {
    const store = createStore();
    const first = store.startRun({ runId: "run-1", pid: 101, launcherVersion: "1.0.0" });
    store.recordExitIntent(first.run.runId, "user-quit");
    store.completeRun(first.run.runId, { outcome: "controlled-exit", code: 0 });
    now = new Date("2026-08-22T10:01:00.000Z");

    const next = store.startRun({ runId: "run-2", pid: 102, launcherVersion: "1.0.0" });

    expect(next.recoveredIncident).toBeNull();
    expect(store.listIncidents()).toHaveLength(0);
  });

  it("reclassifies a recovered incident when native crash evidence arrives", () => {
    const store = createStore();
    store.startRun({ runId: "run-1", pid: 101, launcherVersion: "1.0.0" });
    now = new Date("2026-08-22T10:01:00.000Z");
    const next = store.startRun({ runId: "run-2", pid: 102, launcherVersion: "1.0.0" });
    const incident = store.appendIncidentEvidence(next.recoveredIncident!.incidentId, [{
      source: "crashpad",
      kind: "crashpad.dump",
      observedAt: now.toISOString(),
      facts: { dumpName: "report.dmp" }
    }]);

    expect(incident).toMatchObject({
      reasonCode: "electron-native-crash",
      confidence: "confirmed"
    });
  });

  it("records a guardian-observed exit before Desktop diagnostics initialize", () => {
    const store = createStore();
    const incident = store.recordGuardianPreflightExit({
      runId: "run-early-exit",
      observedAt: now.toISOString(),
      evidence: {
        source: "guardian",
        kind: "guardian.main-exited",
        observedAt: now.toISOString(),
        facts: { code: 1 }
      }
    });

    expect(incident).toMatchObject({
      reasonCode: "unknown-unclean-exit",
      confidence: "unknown",
      runId: "run-early-exit"
    });
    expect(incident.evidenceGaps).toContain("Desktop exited before host diagnostics initialized; its cause could not be observed from inside the process.");
  });
});
