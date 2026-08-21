import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { getDataPath } from "../core-utils/utils/helpers.utils.js";

export const HOST_INCIDENT_SCHEMA_VERSION = 1;

export type HostIncidentReasonCode =
  | "controlled-exit"
  | "main-js-uncaught"
  | "electron-native-crash"
  | "renderer-crash"
  | "gpu-process-crash"
  | "runtime-child-exit"
  | "system-shutdown"
  | "resource-exhaustion"
  | "security-remediation"
  | "external-termination-suspected"
  | "unknown-unclean-exit";

export type HostIncidentConfidence = "confirmed" | "probable" | "suspected" | "unknown";
export type HostDiagnosticFact = string | number | boolean | null;

export type HostDiagnosticEvidence = {
  source: "desktop" | "guardian" | "windows" | "crashpad" | "journal";
  kind: string;
  observedAt: string;
  facts?: Record<string, HostDiagnosticFact>;
};

export type HostRunExitIntent = {
  reason: string;
  recordedAt: string;
};

export type HostRunTerminal = {
  outcome: "controlled-exit" | "failed";
  recordedAt: string;
  code: number | null;
  signal: string | null;
};

export type HostRunState = {
  schemaVersion: typeof HOST_INCIDENT_SCHEMA_VERSION;
  hostKind: "windows-desktop";
  runId: string;
  pid: number;
  launcherVersion: string;
  startedAt: string;
  lastHeartbeatAt: string | null;
  exitIntent: HostRunExitIntent | null;
  terminal: HostRunTerminal | null;
  evidence: HostDiagnosticEvidence[];
};

export type HostIncidentResolution = {
  status: "unresolved" | "mitigated" | "resolved";
  reason: string | null;
  updatedAt: string | null;
};

export type HostIncident = {
  schemaVersion: typeof HOST_INCIDENT_SCHEMA_VERSION;
  incidentId: string;
  hostKind: "windows-desktop";
  runId: string;
  launcherVersion: string;
  startedAt: string;
  lastHeartbeatAt: string | null;
  observedEndedAt: string | null;
  reasonCode: HostIncidentReasonCode;
  confidence: HostIncidentConfidence;
  expected: boolean;
  evidence: HostDiagnosticEvidence[];
  evidenceGaps: string[];
  recovery: {
    attempted: boolean;
    outcome: "not-needed" | "restarted" | "backing-off" | "failed";
    attemptCount: number;
  };
  acknowledgedAt: string | null;
  resolution: HostIncidentResolution;
};

type HostIncidentStoreOptions = {
  rootDir?: string;
  now?: () => Date;
  createId?: () => string;
};

type StartHostRunInput = {
  runId?: string;
  pid: number;
  launcherVersion: string;
};

type CompleteHostRunInput = {
  outcome: HostRunTerminal["outcome"];
  code?: number | null;
  signal?: string | null;
};

const MAX_EVIDENCE = 48;
const MAX_INCIDENTS = 30;
const ACTIVE_RUN_FILE = "active-run.json";

function normalizeFacts(facts: Record<string, HostDiagnosticFact> | undefined): Record<string, HostDiagnosticFact> | undefined {
  if (!facts) {
    return undefined;
  }
  const normalized = Object.entries(facts)
    .filter(([key, value]) => Boolean(key.trim()) && (value === null || ["string", "number", "boolean"].includes(typeof value)))
    .slice(0, 24)
    .reduce<Record<string, HostDiagnosticFact>>((result, [key, value]) => {
      result[key.trim().slice(0, 64)] = typeof value === "string" ? value.slice(0, 256) : value;
      return result;
    }, {});
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeEvidence(evidence: HostDiagnosticEvidence): HostDiagnosticEvidence {
  return {
    source: evidence.source,
    kind: evidence.kind.trim().slice(0, 96),
    observedAt: evidence.observedAt,
    ...(normalizeFacts(evidence.facts) ? { facts: normalizeFacts(evidence.facts) } : {})
  };
}

function classifyIncident(run: HostRunState, incident: HostIncident): Pick<HostIncident, "reasonCode" | "confidence" | "expected" | "evidenceGaps"> {
  if (run.exitIntent || run.terminal?.outcome === "controlled-exit") {
    return {
      reasonCode: "controlled-exit",
      confidence: "confirmed",
      expected: true,
      evidenceGaps: []
    };
  }
  const evidenceKinds = new Set(incident.evidence.map((evidence) => evidence.kind));
  if (evidenceKinds.has("desktop.main-js-uncaught")) {
    return { reasonCode: "main-js-uncaught", confidence: "confirmed", expected: false, evidenceGaps: [] };
  }
  if (evidenceKinds.has("crashpad.dump") || evidenceKinds.has("windows.application-crash")) {
    return { reasonCode: "electron-native-crash", confidence: "confirmed", expected: false, evidenceGaps: [] };
  }
  if (evidenceKinds.has("windows.system-shutdown")) {
    return { reasonCode: "system-shutdown", confidence: "confirmed", expected: false, evidenceGaps: [] };
  }
  if (evidenceKinds.has("windows.security-remediation")) {
    return { reasonCode: "security-remediation", confidence: "confirmed", expected: false, evidenceGaps: [] };
  }
  if (evidenceKinds.has("windows.resource-exhaustion")) {
    return { reasonCode: "resource-exhaustion", confidence: "probable", expected: false, evidenceGaps: [] };
  }
  if (evidenceKinds.has("guardian.main-exited")) {
    return {
      reasonCode: "external-termination-suspected",
      confidence: "suspected",
      expected: false,
      evidenceGaps: ["No crash, system shutdown, resource, or security event was correlated to this run."]
    };
  }
  return {
    reasonCode: "unknown-unclean-exit",
    confidence: "unknown",
    expected: false,
    evidenceGaps: ["The previous Desktop run had no terminal record and no external observer evidence."]
  };
}

export class HostIncidentStore {
  private readonly rootDir: string;
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(options: HostIncidentStoreOptions = {}) {
    this.rootDir = resolve(options.rootDir ?? join(getDataPath(), "diagnostics", "host-incidents"));
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  getRootDir = (): string => this.rootDir;

  startRun = (input: StartHostRunInput): { run: HostRunState; recoveredIncident: HostIncident | null } => {
    this.ensureReady();
    const previous = this.readActiveRun();
    const recoveredIncident = previous && !previous.terminal ? this.createIncidentFromRun(previous) : null;
    const now = this.now().toISOString();
    const run: HostRunState = {
      schemaVersion: HOST_INCIDENT_SCHEMA_VERSION,
      hostKind: "windows-desktop",
      runId: input.runId?.trim() || this.createId(),
      pid: input.pid,
      launcherVersion: input.launcherVersion,
      startedAt: now,
      lastHeartbeatAt: now,
      exitIntent: null,
      terminal: null,
      evidence: [
        {
          source: "desktop",
          kind: "desktop.run-started",
          observedAt: now,
          facts: { pid: input.pid, launcherVersion: input.launcherVersion }
        }
      ]
    };
    this.writeJson(this.activeRunPath(), run);
    return { run, recoveredIncident };
  };

  heartbeat = (runId: string): HostRunState | null => {
    const run = this.readActiveRun();
    if (!run || run.runId !== runId || run.terminal) {
      return null;
    }
    run.lastHeartbeatAt = this.now().toISOString();
    this.writeJson(this.activeRunPath(), run);
    return run;
  };

  recordExitIntent = (runId: string, reason: string): HostRunState | null => {
    const run = this.readActiveRun();
    if (!run || run.runId !== runId || run.terminal) {
      return null;
    }
    run.exitIntent = { reason: reason.trim().slice(0, 128) || "desktop-exit", recordedAt: this.now().toISOString() };
    this.appendRunEvidence(run, {
      source: "desktop",
      kind: "desktop.exit-intent",
      observedAt: run.exitIntent.recordedAt,
      facts: { reason: run.exitIntent.reason }
    });
    this.writeJson(this.activeRunPath(), run);
    return run;
  };

  recordRunEvidence = (runId: string, evidence: HostDiagnosticEvidence): HostRunState | null => {
    const run = this.readActiveRun();
    if (!run || run.runId !== runId) {
      return null;
    }
    this.appendRunEvidence(run, evidence);
    this.writeJson(this.activeRunPath(), run);
    return run;
  };

  getActiveRun = (): HostRunState | null => {
    this.ensureReady();
    return this.readActiveRun();
  };

  completeRun = (runId: string, input: CompleteHostRunInput): HostRunState | null => {
    const run = this.readActiveRun();
    if (!run || run.runId !== runId || run.terminal) {
      return null;
    }
    run.terminal = {
      outcome: input.outcome,
      recordedAt: this.now().toISOString(),
      code: input.code ?? null,
      signal: input.signal ?? null
    };
    this.appendRunEvidence(run, {
      source: "desktop",
      kind: "desktop.run-terminal",
      observedAt: run.terminal.recordedAt,
      facts: { outcome: run.terminal.outcome, code: run.terminal.code, signal: run.terminal.signal }
    });
    this.writeJson(this.activeRunPath(), run);
    return run;
  };

  appendIncidentEvidence = (incidentId: string, evidence: HostDiagnosticEvidence[]): HostIncident | null => {
    const incident = this.readIncident(incidentId);
    if (!incident) {
      return null;
    }
    incident.evidence = [...incident.evidence, ...evidence.map(normalizeEvidence)].slice(-MAX_EVIDENCE);
    const run: HostRunState = {
      schemaVersion: HOST_INCIDENT_SCHEMA_VERSION,
      hostKind: incident.hostKind,
      runId: incident.runId,
      pid: 0,
      launcherVersion: incident.launcherVersion,
      startedAt: incident.startedAt,
      lastHeartbeatAt: incident.lastHeartbeatAt,
      exitIntent: null,
      terminal: null,
      evidence: incident.evidence
    };
    Object.assign(incident, classifyIncident(run, incident));
    this.writeJson(this.incidentPath(incident.incidentId), incident);
    return incident;
  };

  recordObservedIncident = (input: {
    runId: string;
    reasonCode: Extract<HostIncidentReasonCode, "renderer-crash" | "gpu-process-crash" | "runtime-child-exit">;
    evidence: HostDiagnosticEvidence;
  }): HostIncident | null => {
    const run = this.readActiveRun();
    if (!run || run.runId !== input.runId) {
      return null;
    }
    const incident: HostIncident = {
      schemaVersion: HOST_INCIDENT_SCHEMA_VERSION,
      incidentId: this.createId(),
      hostKind: run.hostKind,
      runId: run.runId,
      launcherVersion: run.launcherVersion,
      startedAt: run.startedAt,
      lastHeartbeatAt: run.lastHeartbeatAt,
      observedEndedAt: input.evidence.observedAt,
      reasonCode: input.reasonCode,
      confidence: "confirmed",
      expected: false,
      evidence: [...run.evidence, input.evidence].map(normalizeEvidence).slice(-MAX_EVIDENCE),
      evidenceGaps: [],
      recovery: { attempted: false, outcome: "not-needed", attemptCount: 0 },
      acknowledgedAt: null,
      resolution: { status: "unresolved", reason: null, updatedAt: null }
    };
    this.writeJson(this.incidentPath(incident.incidentId), incident);
    this.trimIncidents();
    return incident;
  };

  recordGuardianPreflightExit = (input: {
    runId: string;
    observedAt: string;
    evidence: HostDiagnosticEvidence;
  }): HostIncident => {
    this.ensureReady();
    const incident: HostIncident = {
      schemaVersion: HOST_INCIDENT_SCHEMA_VERSION,
      incidentId: this.createId(),
      hostKind: "windows-desktop",
      runId: input.runId,
      launcherVersion: "unknown",
      startedAt: input.observedAt,
      lastHeartbeatAt: null,
      observedEndedAt: input.observedAt,
      reasonCode: "unknown-unclean-exit",
      confidence: "unknown",
      expected: false,
      evidence: [normalizeEvidence(input.evidence)],
      evidenceGaps: ["Desktop exited before host diagnostics initialized; its cause could not be observed from inside the process."],
      recovery: { attempted: false, outcome: "not-needed", attemptCount: 0 },
      acknowledgedAt: null,
      resolution: { status: "unresolved", reason: null, updatedAt: null }
    };
    this.writeJson(this.incidentPath(incident.incidentId), incident);
    this.trimIncidents();
    return incident;
  };

  markRecovery = (
    incidentId: string,
    recovery: HostIncident["recovery"]
  ): HostIncident | null => {
    const incident = this.readIncident(incidentId);
    if (!incident) {
      return null;
    }
    incident.recovery = recovery;
    this.writeJson(this.incidentPath(incidentId), incident);
    return incident;
  };

  getLatestIncident = (options: { unresolvedOnly?: boolean } = {}): HostIncident | null => {
    const incidents = this.listIncidents(MAX_INCIDENTS);
    return incidents.find((incident) => !options.unresolvedOnly || incident.resolution.status === "unresolved") ?? null;
  };

  listIncidents = (limit = 10): HostIncident[] => {
    if (!existsSync(this.incidentsDir())) {
      return [];
    }
    return readdirSync(this.incidentsDir())
      .filter((name) => name.endsWith(".json"))
      .map((name) => this.readJson<HostIncident>(join(this.incidentsDir(), name)))
      .filter((incident): incident is HostIncident => Boolean(incident))
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
      .slice(0, Math.max(1, Math.min(MAX_INCIDENTS, limit)));
  };

  private createIncidentFromRun = (run: HostRunState): HostIncident => {
    const unfinishedRunEvidence: HostDiagnosticEvidence = {
      source: "journal",
      kind: "journal.previous-run-unfinished",
      observedAt: this.now().toISOString(),
      facts: { pid: run.pid }
    };
    const incident: HostIncident = {
      schemaVersion: HOST_INCIDENT_SCHEMA_VERSION,
      incidentId: this.createId(),
      hostKind: run.hostKind,
      runId: run.runId,
      launcherVersion: run.launcherVersion,
      startedAt: run.startedAt,
      lastHeartbeatAt: run.lastHeartbeatAt,
      observedEndedAt: this.now().toISOString(),
      reasonCode: "unknown-unclean-exit",
      confidence: "unknown",
      expected: false,
      evidence: [
        ...run.evidence,
        unfinishedRunEvidence
      ].map(normalizeEvidence).slice(-MAX_EVIDENCE),
      evidenceGaps: [],
      recovery: this.resolveRecovery(run.evidence),
      acknowledgedAt: null,
      resolution: { status: "unresolved", reason: null, updatedAt: null }
    };
    Object.assign(incident, classifyIncident(run, incident));
    this.writeJson(this.incidentPath(incident.incidentId), incident);
    this.trimIncidents();
    return incident;
  };

  private appendRunEvidence = (run: HostRunState, evidence: HostDiagnosticEvidence): void => {
    run.evidence = [...run.evidence, normalizeEvidence(evidence)].slice(-MAX_EVIDENCE);
  };

  private resolveRecovery = (evidence: HostDiagnosticEvidence[]): HostIncident["recovery"] => {
    const recoveryEvidence = [...evidence].reverse().find((entry) => entry.kind.startsWith("guardian.recovery-"));
    if (!recoveryEvidence) {
      return { attempted: false, outcome: "not-needed", attemptCount: 0 };
    }
    const attempt = typeof recoveryEvidence.facts?.attempt === "number" ? recoveryEvidence.facts.attempt : 0;
    if (recoveryEvidence.kind === "guardian.recovery-restarted") {
      return { attempted: true, outcome: "restarted", attemptCount: attempt };
    }
    if (recoveryEvidence.kind === "guardian.recovery-backing-off") {
      return { attempted: true, outcome: "backing-off", attemptCount: attempt };
    }
    return { attempted: true, outcome: "failed", attemptCount: attempt };
  };

  private ensureReady = (): void => {
    mkdirSync(this.incidentsDir(), { recursive: true });
  };

  private activeRunPath = (): string => join(this.rootDir, ACTIVE_RUN_FILE);

  private incidentsDir = (): string => join(this.rootDir, "incidents");

  private incidentPath = (incidentId: string): string => join(this.incidentsDir(), `${incidentId}.json`);

  private readActiveRun = (): HostRunState | null => this.readJson<HostRunState>(this.activeRunPath());

  private readIncident = (incidentId: string): HostIncident | null => this.readJson<HostIncident>(this.incidentPath(incidentId));

  private readJson = <Value>(path: string): Value | null => {
    if (!existsSync(path)) {
      return null;
    }
    try {
      return JSON.parse(readFileSync(path, "utf8")) as Value;
    } catch {
      return null;
    }
  };

  private writeJson = (path: string, value: unknown): void => {
    mkdirSync(dirname(path), { recursive: true });
    const temporaryPath = `${path}.${process.pid}.${this.createId()}.tmp`;
    writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    renameSync(temporaryPath, path);
  };

  private trimIncidents = (): void => {
    const excess = this.listIncidents(MAX_INCIDENTS + 1).slice(MAX_INCIDENTS);
    for (const incident of excess) {
      rmSync(this.incidentPath(incident.incidentId), { force: true });
    }
  };
}
