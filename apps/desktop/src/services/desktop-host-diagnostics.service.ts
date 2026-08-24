import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  HostIncidentStore,
  type HostDiagnosticEvidence,
  type HostIncident
} from "@nextclaw/core/host-incident";
import type { DesktopLogger } from "../utils/desktop-logging.utils";
import { collectWindowsHostEvidence } from "../utils/windows-host-evidence.utils";

type DesktopHostDiagnosticsOptions = {
  logger: DesktopLogger;
  launcherVersion: string;
  crashDumpsPath: string;
  store?: HostIncidentStore;
  pid?: number;
  runId?: string;
  heartbeatMs?: number;
  collectWindowsEvidence?: (input: {
    startedAt: string;
    observedEndedAt: string;
    applicationNames: string[];
  }) => HostDiagnosticEvidence[];
};

type ProcessGoneDetails = {
  reason?: string;
  exitCode?: number;
  type?: string;
  name?: string;
};

export class DesktopHostDiagnosticsService {
  private readonly store: HostIncidentStore;
  private readonly heartbeatMs: number;
  private readonly collectWindowsEvidence: NonNullable<DesktopHostDiagnosticsOptions["collectWindowsEvidence"]>;
  private runId: string | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private crashMonitorInstalled = false;

  constructor(private readonly options: DesktopHostDiagnosticsOptions) {
    this.store = options.store ?? new HostIncidentStore();
    this.heartbeatMs = Math.max(10_000, options.heartbeatMs ?? 60_000);
    this.collectWindowsEvidence = options.collectWindowsEvidence ?? collectWindowsHostEvidence;
  }

  start = (): HostIncident | null => {
    const started = this.store.startRun({
      runId: this.options.runId ?? process.env.NEXTCLAW_DESKTOP_RUN_ID,
      pid: this.options.pid ?? process.pid,
      launcherVersion: this.options.launcherVersion
    });
    this.runId = started.run.runId;
    this.installCrashMonitor();
    this.startHeartbeat();
    if (!started.recoveredIncident) {
      return null;
    }
    const incident = this.enrichRecoveredIncident(started.recoveredIncident);
    this.options.logger.warn(
      [
        "desktop.hostIncident.recovered",
        `incidentId=${incident.incidentId}`,
        `reasonCode=${incident.reasonCode}`,
        `confidence=${incident.confidence}`
      ].join(" ")
    );
    return incident;
  };

  dispose = (): void => {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  };

  recordExitIntent = (reason: string): void => {
    if (!this.runId) {
      return;
    }
    this.store.recordExitIntent(this.runId, reason);
  };

  complete = (input: { outcome: "controlled-exit" | "failed"; code?: number | null; signal?: string | null }): void => {
    if (!this.runId) {
      return;
    }
    this.store.completeRun(this.runId, input);
    this.dispose();
  };

  recordRuntimeChildExit = (input: { childPid: number | null | undefined; code: number | null; signal: string | null; expected: boolean }): void => {
    const evidence: HostDiagnosticEvidence = {
      source: "desktop",
      kind: "desktop.runtime-child-exited",
      observedAt: new Date().toISOString(),
      facts: {
        childPid: input.childPid ?? null,
        code: input.code,
        signal: input.signal,
        expected: input.expected
      }
    };
    this.recordEvidence(evidence);
    if (!input.expected && this.runId) {
      this.store.recordObservedIncident({ runId: this.runId, reasonCode: "runtime-child-exit", evidence });
    }
  };

  recordRendererGone = (details: ProcessGoneDetails): void => {
    const evidence: HostDiagnosticEvidence = {
      source: "desktop",
      kind: "desktop.renderer-gone",
      observedAt: new Date().toISOString(),
      facts: {
        reason: details.reason ?? "unknown",
        exitCode: details.exitCode ?? null
      }
    };
    this.recordEvidence(evidence);
    if (this.runId) {
      this.store.recordObservedIncident({ runId: this.runId, reasonCode: "renderer-crash", evidence });
    }
  };

  recordChildProcessGone = (details: ProcessGoneDetails): void => {
    const kind = details.type === "GPU" || details.name === "GPU" ? "desktop.gpu-gone" : "desktop.child-process-gone";
    const evidence: HostDiagnosticEvidence = {
      source: "desktop",
      kind,
      observedAt: new Date().toISOString(),
      facts: {
        type: details.type ?? "unknown",
        name: details.name ?? "unknown",
        reason: details.reason ?? "unknown",
        exitCode: details.exitCode ?? null
      }
    };
    this.recordEvidence(evidence);
    if (kind === "desktop.gpu-gone" && this.runId) {
      this.store.recordObservedIncident({ runId: this.runId, reasonCode: "gpu-process-crash", evidence });
    }
  };

  private enrichRecoveredIncident = (incident: HostIncident): HostIncident => {
    const crashEvidence = this.collectCrashDumpEvidence(incident);
    const windowsEvidence = this.collectWindowsEvidence({
      startedAt: incident.startedAt,
      observedEndedAt: incident.observedEndedAt ?? new Date().toISOString(),
      applicationNames: ["NextClaw Desktop.exe", "nextclaw desktop", "electron.exe"]
    });
    return this.store.appendIncidentEvidence(incident.incidentId, [...crashEvidence, ...windowsEvidence]) ?? incident;
  };

  private collectCrashDumpEvidence = (incident: HostIncident): HostDiagnosticEvidence[] => {
    if (!existsSync(this.options.crashDumpsPath)) {
      return [];
    }
    const startedAt = Date.parse(incident.startedAt) - 120_000;
    const endedAt = Date.parse(incident.observedEndedAt ?? new Date().toISOString()) + 120_000;
    return readdirSync(this.options.crashDumpsPath)
      .filter((name) => name.endsWith(".dmp"))
      .flatMap((name) => {
        const path = join(this.options.crashDumpsPath, name);
        const modifiedAt = statSync(path).mtime;
        if (modifiedAt.getTime() < startedAt || modifiedAt.getTime() > endedAt) {
          return [];
        }
        return [{
          source: "crashpad" as const,
          kind: "crashpad.dump",
          observedAt: modifiedAt.toISOString(),
          facts: { dumpName: name, sizeBytes: statSync(path).size }
        }];
      });
  };

  private installCrashMonitor = (): void => {
    if (this.crashMonitorInstalled) {
      return;
    }
    this.crashMonitorInstalled = true;
    process.on("uncaughtExceptionMonitor", (error, origin) => {
      this.options.logger.error(`uncaughtException: ${error.stack ?? String(error)}`);
      this.recordEvidence({
        source: "desktop",
        kind: "desktop.main-js-uncaught",
        observedAt: new Date().toISOString(),
        facts: { origin }
      });
    });
  };

  private startHeartbeat = (): void => {
    if (this.heartbeatTimer || !this.runId) {
      return;
    }
    this.heartbeatTimer = setInterval(() => {
      if (this.runId) {
        this.store.heartbeat(this.runId);
      }
    }, this.heartbeatMs);
    this.heartbeatTimer.unref();
  };

  private recordEvidence = (evidence: HostDiagnosticEvidence): void => {
    if (this.runId) {
      this.store.recordRunEvidence(this.runId, evidence);
    }
  };
}
