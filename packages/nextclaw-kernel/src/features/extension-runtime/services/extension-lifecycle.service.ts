import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { realpathSync, readlinkSync } from "node:fs";
import { resolve } from "node:path";
import { readExtensionProcessMemory } from "@kernel/features/extension-runtime/utils/extension-process-memory.utils.js";
import type {
  ExtensionLease,
  ExtensionLeaseReason,
  ExtensionManifest,
  ExtensionProcessExitEvent,
  ExtensionProcessState,
  ExtensionRuntimeStatus,
} from "@kernel/features/extension-runtime/index.js";
import { createRuntimeChildEnv, resolveRuntimeCommandLaunch, type DiagnosticRuntime } from "@nextclaw/core";
import { classifyDiagnosticError } from "@nextclaw/shared";

type ExtensionLifecycleServiceOptions = {
  cleanupOrphanProcesses?: (manifests: ExtensionManifest[]) => void;
  diagnostics?: Pick<DiagnosticRuntime, "record">;
  onProcessExit?: (event: ExtensionProcessExitEvent) => void;
  restartDelaysMs?: readonly number[];
  startupTimeoutMs?: number;
  stopGraceMs?: number;
};

type Deferred = {
  promise: Promise<void>;
  reject: (error: Error) => void;
  resolve: () => void;
};

type ExtensionLifecycleRecord = {
  endpoint: string;
  expectedStopGeneration: string | null;
  exit: Deferred | null;
  generation: string | null;
  lastExit: ExtensionRuntimeStatus["lastExit"];
  leases: Map<string, ExtensionLeaseReason>;
  manifest: ExtensionManifest;
  process: ChildProcess | null;
  ready: Deferred | null;
  restartAttempts: number;
  restartTimer: ReturnType<typeof setTimeout> | null;
  stableTimer: ReturnType<typeof setTimeout> | null;
  startedAt: string | null;
  startedAtMs: number | null;
  startPromise: Promise<void> | null;
  startupTimer: ReturnType<typeof setTimeout> | null;
  state: ExtensionProcessState;
  stopTimer: ReturnType<typeof setTimeout> | null;
  startupDurationMs: number | null;
  token: string | null;
};

type ProcessSnapshot = {
  pid: number;
  ppid: number;
  command: string;
};

type PreparedExtensionStart = {
  generation: string;
  manifest: ExtensionManifest;
  ready: Deferred;
  token: string;
};

export class ExtensionLifecycleService {
  private readonly records = new Map<string, ExtensionLifecycleRecord>();
  private shuttingDown = false;

  constructor(private readonly options: ExtensionLifecycleServiceOptions = {}) {}

  acquire = async (manifest: ExtensionManifest, params: {
    endpoint: string;
    expectedGeneration?: string;
    reason: ExtensionLeaseReason;
  }): Promise<ExtensionLease> => {
    const { endpoint, expectedGeneration, reason } = params;
    const record = this.getOrCreateRecord(manifest, endpoint);
    if (expectedGeneration && record.generation !== expectedGeneration) {
      throw new Error(`Extension ${manifest.id} generation changed; retry the operation.`);
    }
    const leaseId = randomUUID();
    record.leases.set(leaseId, reason);
    this.clearStopTimer(record);
    this.clearRestartTimer(record);
    try {
      await this.ensureRunning(record);
    } catch (error) {
      record.leases.delete(leaseId);
      this.scheduleStopWhenIdle(record);
      throw error;
    }
    const generation = record.generation;
    if (!generation || (expectedGeneration && generation !== expectedGeneration)) {
      record.leases.delete(leaseId);
      this.scheduleStopWhenIdle(record);
      throw new Error(`Extension ${manifest.id} generation changed before it became ready.`);
    }
    let released = false;
    return {
      extensionId: manifest.id,
      generation,
      id: leaseId,
      reason,
      release: () => {
        if (released) {
          return;
        }
        released = true;
        this.releaseLease(manifest.id, leaseId);
      },
    };
  };

  authenticateCredential = (input: {
    extensionId: string | null;
    generation: string | null;
    token: string | null;
  }): { extensionId: string; generation: string } | null => {
    const extensionId = input.extensionId?.trim();
    const generation = input.generation?.trim();
    const token = input.token?.trim();
    if (!extensionId || !generation || !token) {
      return null;
    }
    const record = this.records.get(extensionId);
    if (
      !record ||
      record.generation !== generation ||
      record.token !== token ||
      !record.process ||
      (record.state !== "starting" && record.state !== "running" && record.state !== "stopping")
    ) {
      return null;
    }
    return { extensionId, generation };
  };

  markReady = (input: { extensionId: string; generation: string; pid: number }): void => {
    const record = this.records.get(input.extensionId);
    if (
      !record ||
      record.state !== "starting" ||
      record.generation !== input.generation ||
      record.process?.pid !== input.pid ||
      !record.ready
    ) {
      throw new Error(`Stale extension ready signal rejected: ${input.extensionId}`);
    }
    this.clearStartupTimer(record);
    record.state = "running";
    record.startupDurationMs = record.startedAtMs === null ? null : Date.now() - record.startedAtMs;
    this.recordLifecycle(record, "process.ready", "succeeded", {
      durationMs: record.startupDurationMs ?? undefined,
      facts: { pid: input.pid },
    });
    record.ready.resolve();
    this.clearStableTimer(record);
    record.stableTimer = setTimeout(() => {
      record.restartAttempts = 0;
      record.stableTimer = null;
    }, 60_000);
    record.stableTimer.unref?.();
  };

  getCurrentGeneration = (extensionId: string): string | null =>
    this.records.get(extensionId)?.generation ?? null;

  getStatus = (): ExtensionRuntimeStatus[] =>
    [...this.records.values()].map((record) => ({
      extensionId: record.manifest.id,
      generation: record.generation,
      lastExit: record.lastExit,
      leaseReasons: [...record.leases.values()],
      memory: record.process?.pid ? readExtensionProcessMemory(record.process.pid) : null,
      pid: record.process?.pid ?? null,
      startedAt: record.startedAt,
      state: record.state,
      startupDurationMs: record.startupDurationMs,
    }));

  stopAll = async (): Promise<void> => {
    this.shuttingDown = true;
    const records = [...this.records.values()];
    for (const record of records) {
      record.leases.clear();
      this.clearRecordTimers(record);
    }
    await Promise.all(records.map(async (record) => await this.stopRecord(record)));
    this.records.clear();
    this.shuttingDown = false;
  };

  private getOrCreateRecord = (manifest: ExtensionManifest, endpoint: string): ExtensionLifecycleRecord => {
    const existing = this.records.get(manifest.id);
    if (existing) {
      existing.manifest = manifest;
      existing.endpoint = endpoint;
      return existing;
    }
    const record: ExtensionLifecycleRecord = {
      endpoint,
      expectedStopGeneration: null,
      exit: null,
      generation: null,
      lastExit: null,
      leases: new Map(),
      manifest,
      process: null,
      ready: null,
      restartAttempts: 0,
      restartTimer: null,
      stableTimer: null,
      startedAt: null,
      startedAtMs: null,
      startPromise: null,
      startupTimer: null,
      state: "stopped",
      stopTimer: null,
      startupDurationMs: null,
      token: null,
    };
    this.records.set(manifest.id, record);
    return record;
  };

  private ensureRunning = async (record: ExtensionLifecycleRecord): Promise<void> => {
    if (record.state === "running") {
      return;
    }
    if (!record.startPromise) {
      record.startPromise = this.startSequence(record).finally(() => {
        record.startPromise = null;
      });
    }
    await record.startPromise;
  };

  private startSequence = async (record: ExtensionLifecycleRecord): Promise<void> => {
    if (record.state === "stopping" && record.exit) {
      await record.exit.promise;
    }
    if (record.leases.size === 0 || this.shuttingDown) {
      return;
    }
    if (record.state === "running") {
      return;
    }
    const { generation, manifest, ready, token } = this.prepareStart(record);
    this.recordLifecycle(record, "process.spawn.started", "started");
    const launch = resolveRuntimeCommandLaunch(manifest.server.command);
    const child = spawn(launch.command, manifest.server.args ?? [], {
      cwd: manifest.rootDir,
      env: createRuntimeChildEnv(process.env, {
        ...manifest.server.env,
        ...launch.envPatch,
        NEXTCLAW_EXTENSION_ID: manifest.id,
        NEXTCLAW_EXTENSION_ENDPOINT: record.endpoint,
        NEXTCLAW_EXTENSION_GENERATION: generation,
        NEXTCLAW_EXTENSION_PARENT_PID: String(process.pid),
        NEXTCLAW_EXTENSION_TOKEN: token,
      }, { inheritBaseEnv: true }),
      stdio: ["ignore", "ignore", "inherit"],
      windowsHide: true,
    });
    record.process = child;
    record.startupTimer = setTimeout(() => {
      if (record.process !== child || record.generation !== generation || record.state !== "starting") {
        return;
      }
      ready.reject(new Error(`Extension ${manifest.id} failed to become ready within ${this.startupTimeoutMs}ms.`));
      this.recordLifecycle(record, "process.ready.failed", "failed", {
        durationMs: this.startupTimeoutMs,
        reasonCode: "startup_timeout",
      });
      child.kill();
    }, this.startupTimeoutMs);
    record.startupTimer.unref?.();
    child.once("exit", (code, signal) => {
      this.handleProcessExit(record, child, generation, code, signal);
    });
    child.once("error", (error) => {
      if (record.process === child && record.generation === generation) {
        ready.reject(error);
        this.handleProcessExit(record, child, generation, null, null);
      }
      const classification = classifyDiagnosticError(error);
      this.recordLifecycle(
        record,
        classification.outcome === "cancelled" ? "process.spawn.cancelled" : "process.spawn.failed",
        classification.outcome,
        {
          reasonCode: classification.reasonCode,
          providerCode: classification.providerCode,
          facts: classification.facts,
        },
      );
    });
    try {
      await ready.promise;
    } catch (error) {
      if (record.process === child && record.generation === generation) {
        record.state = "failed";
      }
      throw error;
    }
  };

  private handleProcessExit = (
    record: ExtensionLifecycleRecord,
    child: ChildProcess,
    generation: string,
    code: number | null,
    signal: NodeJS.Signals | null,
  ): void => {
    if (record.process !== child || record.generation !== generation) {
      return;
    }
    const expected = record.expectedStopGeneration === generation || this.shuttingDown;
    this.clearStartupTimer(record);
    this.clearStableTimer(record);
    if (record.state === "starting") {
      record.ready?.reject(new Error(`Extension ${record.manifest.id} exited before becoming ready.`));
    }
    record.process = null;
    record.token = null;
    record.ready = null;
    record.expectedStopGeneration = null;
    record.state = expected ? "stopped" : "failed";
    record.lastExit = {
      at: new Date().toISOString(),
      code,
      expected,
      signal,
    };
    this.recordLifecycle(
      record,
      "process.exited",
      expected ? "succeeded" : "failed",
      {
        reasonCode: expected ? undefined : signal ? "signal_exit" : "unexpected_exit",
        facts: {
          expected,
          ...(code !== null ? { exitCode: code } : {}),
          ...(signal ? { signal } : {}),
        },
      },
    );
    record.exit?.resolve();
    record.exit = null;
    this.options.onProcessExit?.({
      extensionId: record.manifest.id,
      generation,
      expected,
    });
    if (!expected && this.hasPersistentLease(record) && !this.shuttingDown) {
      this.scheduleRestart(record);
    } else if (record.leases.size === 0) {
      record.restartAttempts = 0;
    }
  };

  private scheduleRestart = (record: ExtensionLifecycleRecord): void => {
    if (record.restartTimer) {
      return;
    }
    const delay = this.restartDelaysMs[record.restartAttempts];
    if (delay === undefined) {
      this.recordLifecycle(record, "restart.limit-reached", "failed", {
        attempt: record.restartAttempts,
        reasonCode: "restart_limit",
      });
      return;
    }
    record.restartAttempts += 1;
    this.recordLifecycle(record, "restart.scheduled", "started", {
      attempt: record.restartAttempts,
      facts: { delayMs: delay },
    });
    record.restartTimer = setTimeout(() => {
      record.restartTimer = null;
      if (!this.hasPersistentLease(record) || this.shuttingDown) {
        return;
      }
      void this.ensureRunning(record).catch((error) => {
        const classification = classifyDiagnosticError(error);
        this.recordLifecycle(record, classification.outcome === "cancelled" ? "restart.cancelled" : "restart.failed", classification.outcome, {
          attempt: record.restartAttempts,
          reasonCode: classification.reasonCode,
          providerCode: classification.providerCode,
          facts: classification.facts,
        });
        this.scheduleRestart(record);
      });
    }, delay);
    record.restartTimer.unref?.();
  };

  private readonly recordLifecycle = (
    record: ExtensionLifecycleRecord,
    event: string,
    outcome: "started" | "succeeded" | "cancelled" | "failed",
    details: {
      durationMs?: number;
      attempt?: number;
      reasonCode?: string;
      providerCode?: string;
      facts?: Record<string, string | number | boolean | null>;
    } = {},
  ): void => {
    this.options.diagnostics?.record({
      domain: "extension.lifecycle",
      event,
      component: "kernel.extension-lifecycle",
      outcome,
      correlationId: record.generation ?? undefined,
      durationMs: details.durationMs,
      attempt: details.attempt,
      reasonCode: details.reasonCode,
      providerCode: details.providerCode,
      facts: {
        extensionId: record.manifest.id,
        generation: record.generation ?? "pending",
        ...(details.facts ?? {}),
      },
    });
  };

  private releaseLease = (extensionId: string, leaseId: string): void => {
    const record = this.records.get(extensionId);
    if (!record || !record.leases.delete(leaseId)) {
      return;
    }
    if (record.leases.size === 0) {
      this.clearRestartTimer(record);
      this.scheduleStopWhenIdle(record);
    }
  };

  private scheduleStopWhenIdle = (record: ExtensionLifecycleRecord): void => {
    if (record.leases.size > 0 || record.stopTimer || this.shuttingDown) {
      return;
    }
    record.stopTimer = setTimeout(() => {
      record.stopTimer = null;
      if (record.leases.size === 0) {
        void this.stopRecord(record);
      }
    }, this.stopGraceMs);
    record.stopTimer.unref?.();
  };

  private stopRecord = async (record: ExtensionLifecycleRecord): Promise<void> => {
    const child = record.process;
    const generation = record.generation;
    if (!child || !generation || child.exitCode !== null || child.signalCode !== null) {
      record.state = "stopped";
      record.process = null;
      record.token = null;
      return;
    }
    record.state = "stopping";
    record.expectedStopGeneration = generation;
    child.kill();
    const exited = await Promise.race([
      (record.exit?.promise ?? Promise.resolve()).then(() => true),
      new Promise<boolean>((resolvePromise) => {
        const timer = setTimeout(() => resolvePromise(false), 1000);
        timer.unref?.();
      }),
    ]);
    if (!exited && record.process === child && record.generation === generation) {
      child.kill("SIGKILL");
    }
  };

  private hasPersistentLease = (record: ExtensionLifecycleRecord): boolean =>
    [...record.leases.values()].some((reason) => reason.kind === "enabled-channel");

  private createDeferred = (): Deferred => {
    let resolvePromise!: () => void;
    let rejectPromise!: (error: Error) => void;
    const promise = new Promise<void>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });
    return { promise, reject: rejectPromise, resolve: resolvePromise };
  };

  private prepareStart = (record: ExtensionLifecycleRecord): PreparedExtensionStart => {
    const manifest = record.manifest;
    this.cleanupOrphanProcesses([manifest]);
    const generation = randomUUID();
    const token = randomUUID();
    const ready = this.createDeferred();
    const exit = this.createDeferred();
    Object.assign(record, {
      exit,
      expectedStopGeneration: null,
      generation,
      ready,
      startedAt: new Date().toISOString(),
      startedAtMs: Date.now(),
      startupDurationMs: null,
      state: "starting" as const,
      token,
    });
    return { generation, manifest, ready, token };
  };

  private clearRecordTimers = (record: ExtensionLifecycleRecord): void => {
    this.clearRestartTimer(record);
    this.clearStableTimer(record);
    this.clearStartupTimer(record);
    this.clearStopTimer(record);
  };

  private clearRestartTimer = (record: ExtensionLifecycleRecord): void => {
    if (record.restartTimer) {
      clearTimeout(record.restartTimer);
      record.restartTimer = null;
    }
  };

  private clearStableTimer = (record: ExtensionLifecycleRecord): void => {
    if (record.stableTimer) {
      clearTimeout(record.stableTimer);
      record.stableTimer = null;
    }
  };

  private clearStartupTimer = (record: ExtensionLifecycleRecord): void => {
    if (record.startupTimer) {
      clearTimeout(record.startupTimer);
      record.startupTimer = null;
    }
  };

  private clearStopTimer = (record: ExtensionLifecycleRecord): void => {
    if (record.stopTimer) {
      clearTimeout(record.stopTimer);
      record.stopTimer = null;
    }
  };

  private get restartDelaysMs(): readonly number[] {
    return this.options.restartDelaysMs ?? [1_000, 5_000, 30_000];
  }

  private get startupTimeoutMs(): number {
    return this.options.startupTimeoutMs ?? 15_000;
  }

  private get stopGraceMs(): number {
    return this.options.stopGraceMs ?? 30_000;
  };

  private cleanupOrphanProcesses = (manifests: ExtensionManifest[]): void => {
    if (this.options.cleanupOrphanProcesses) {
      this.options.cleanupOrphanProcesses(manifests);
      return;
    }
    if (process.platform === "win32" || process.env.NEXTCLAW_EXTENSION_ORPHAN_CLEANUP === "0") {
      return;
    }
    try {
      const roots = this.resolveManifestRoots(manifests);
      for (const snapshot of this.listOrphanNodeDistMainProcesses()) {
        const cwd = this.readProcessCwd(snapshot.pid);
        if (!cwd || !this.isNextClawChannelExtensionCwd(cwd, roots)) {
          continue;
        }
        try {
          process.kill(snapshot.pid, "SIGTERM");
          console.warn(`Stopped orphan extension process ${snapshot.pid} (${cwd}).`);
        } catch (error) {
          console.warn(
            `Failed to stop orphan extension process ${snapshot.pid}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    } catch (error) {
      console.warn(`Extension orphan cleanup skipped: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  private resolveManifestRoots = (manifests: ExtensionManifest[]): Set<string> => {
    return new Set(manifests.map((manifest) => this.normalizePath(manifest.rootDir)));
  };

  private normalizePath = (value: string): string => {
    try {
      return realpathSync(value);
    } catch {
      return resolve(value);
    }
  };

  private listOrphanNodeDistMainProcesses = (): ProcessSnapshot[] => {
    const output = execFileSync("ps", ["-axo", "pid=,ppid=,command="], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    return output.split("\n")
      .map((line) => {
        const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/);
        if (!match) {
          return null;
        }
        return {
          pid: Number(match[1]),
          ppid: Number(match[2]),
          command: match[3] ?? "",
        };
      })
      .filter((snapshot): snapshot is ProcessSnapshot =>
        Boolean(snapshot && snapshot.ppid === 1 && this.isNodeDistMainCommand(snapshot.command))
      );
  };

  private isNodeDistMainCommand = (command: string): boolean => {
    return /(?:^|\s|\/)node(?:\.exe)?\s+dist\/main\.js(?:\s|$)/.test(command);
  };

  private readProcessCwd = (pid: number): string | null => {
    if (process.platform === "linux") {
      try {
        return this.normalizePath(readlinkSync(`/proc/${pid}/cwd`));
      } catch {
        return null;
      }
    }
    try {
      const output = execFileSync("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      const cwd = output.split("\n").find((line) => line.startsWith("n"))?.slice(1).trim();
      return cwd ? this.normalizePath(cwd) : null;
    } catch {
      return null;
    }
  };

  private isNextClawChannelExtensionCwd = (cwd: string, roots: Set<string>): boolean => {
    if (roots.has(cwd)) {
      return true;
    }
    return /(?:^|\/)nextclaw-channel-extension-[^/]+$/.test(cwd)
      || /\/node_modules\/@nextclaw\/channel-extension-[^/]+$/.test(cwd)
      || /\/node_modules\/\.nextclaw-[^/]+\/node_modules\/@nextclaw\/channel-extension-[^/]+$/.test(cwd);
  };

}
