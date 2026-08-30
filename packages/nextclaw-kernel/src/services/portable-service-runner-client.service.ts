import { spawn, type ChildProcessByStdio } from "node:child_process";
import { randomUUID } from "node:crypto";
import { accessSync, constants } from "node:fs";
import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import { readExtensionProcessMemory } from "@kernel/features/extension-runtime/index.js";
import type {
  PortableRunnerAction,
  PortableRunnerApp,
  PortableRunnerHostCallHandler,
  PortableRunnerHostCallRequest,
  PortableRunnerJob,
  PortableRunnerJobEvent,
  PortableRunnerObservation,
  RunnerOperation,
  RunnerOutput,
  RunnerRequest,
  RunnerResponse,
} from "@kernel/types/portable-service-runner-protocol.types.js";
export type {
  PortableRunnerAction,
  PortableRunnerApp,
  PortableRunnerFileMount,
  PortableRunnerHostCallHandler,
  PortableRunnerHostCallRequest,
  PortableRunnerJob,
  PortableRunnerJobEvent,
  PortableRunnerObservation,
} from "@kernel/types/portable-service-runner-protocol.types.js";

const PORTABLE_RUNNER_PROTOCOL_VERSION = "0.2.0";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  startedAt: number;
  operation: RunnerOperation;
  appId?: string;
};

type ActiveJob = {
  callbacks: Set<(event: PortableRunnerJobEvent) => void>;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  settled: boolean;
  hostCall?: PortableRunnerHostCallHandler;
  hostCalls: Map<string, AbortController>;
};

export class PortableServiceRunnerError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "PortableServiceRunnerError";
  }
}

export class PortableServiceRunnerClientService {
  private child?: ChildProcessByStdio<Writable, Readable, Readable>;
  private readonly pending = new Map<string, PendingRequest>();
  private readonly jobs = new Map<string, ActiveJob>();
  private stderrTail: string[] = [];
  private lastObservation?: PortableRunnerObservation;

  constructor(
    private readonly params: {
      runnerPath?: string;
      env?: NodeJS.ProcessEnv;
      onUnexpectedExit?: (error: PortableServiceRunnerError) => void;
    } = {},
  ) {}

  listActions = async (
    app: PortableRunnerApp,
  ): Promise<PortableRunnerAction[]> =>
    this.request<PortableRunnerAction[]>(
      { operation: "list-actions", app },
      7_000,
    );

  invoke = async (
    app: PortableRunnerApp,
    actionName: string,
    input: Record<string, unknown>,
    timeoutMs = 7_000,
    hostCall?: PortableRunnerHostCallHandler,
  ): Promise<unknown> => {
    const job = await this.startJob(app, actionName, input, undefined, undefined, timeoutMs, hostCall);
    return await this.waitForJob(job.jobId, job.result, timeoutMs);
  };

  /** Starts isolated execution and returns immediately; events are delivered in order. */
  startJob = async (
    app: PortableRunnerApp,
    actionName: string,
    input: Record<string, unknown>,
    watch?: (event: PortableRunnerJobEvent) => void,
    requestedJobId?: string,
    timeoutMs?: number,
    hostCall?: PortableRunnerHostCallHandler,
    callId?: string,
    traceId?: string,
  ): Promise<PortableRunnerJob> => {
    const jobId = requestedJobId ?? randomUUID();
    let resolve!: (value: unknown) => void;
    let reject!: (error: Error) => void;
    const result = new Promise<unknown>((resolveResult, rejectResult) => {
      resolve = resolveResult;
      reject = rejectResult;
    });
    const callbacks = new Set<(event: PortableRunnerJobEvent) => void>();
    if (watch) callbacks.add(watch);
    this.jobs.set(jobId, { callbacks, resolve, reject, settled: false, hostCall, hostCalls: new Map() });
    try {
      const started = await this.request<{ jobId?: string }>(
        { operation: "start-job", app, actionName, input, jobId, timeoutMs, callId, traceId },
        7_000,
      );
      const runnerJobId = started?.jobId ?? jobId;
      if (runnerJobId !== jobId) {
        const active = this.jobs.get(jobId);
        if (active) {
          this.jobs.delete(jobId);
          this.jobs.set(runnerJobId, active);
        }
      }
      return { jobId: runnerJobId, result };
    } catch (error) {
      this.jobs.delete(jobId);
      reject(error instanceof Error ? error : new Error(String(error)));
      // Marking the rejection observed prevents an immediate start failure
      // from becoming an unhandled rejection before the caller sees it.
      void result.catch(() => undefined);
      throw error;
    }
  };

  cancelJob = async (jobId: string, cancelReason?: "timeout"): Promise<void> => {
    this.abortHostCalls(jobId, new Error("Portable Job was cancelled."));
    await this.request({ operation: "cancel-job", jobId, cancelReason }, 2_000);
  };

  jobStatus = async (jobId: string): Promise<{ jobId: string; active: boolean }> =>
    await this.request({ operation: "job-status", jobId }, 2_000);

  runJob = async (
    app: PortableRunnerApp,
    actionName: string,
    input: Record<string, unknown>,
    params: {
      jobId: string;
      timeoutMs: number;
      watch?: (event: PortableRunnerJobEvent) => void;
      hostCall?: PortableRunnerHostCallHandler;
      callId?: string;
      traceId?: string;
    },
  ): Promise<unknown> => {
    const { watch, jobId, timeoutMs, hostCall, callId, traceId } = params;
    const job = await this.startJob(
      app,
      actionName,
      input,
      watch,
      jobId,
      timeoutMs,
      hostCall,
      callId,
      traceId,
    );
    return await this.waitForJob(job.jobId, job.result, timeoutMs);
  };

  watchJob = (
    jobId: string,
    callback: (event: PortableRunnerJobEvent) => void,
  ): (() => void) => {
    const job = this.jobs.get(jobId);
    if (!job) return () => undefined;
    job.callbacks.add(callback);
    return () => job.callbacks.delete(callback);
  };

  startResident = async (
    app: PortableRunnerApp,
    config: Record<string, unknown>,
  ): Promise<unknown> =>
    this.request({ operation: "start-resident", app, input: config }, 7_000);

  startProvider = async (
    app: PortableRunnerApp,
    config: Record<string, unknown>,
  ): Promise<unknown> =>
    this.request({ operation: "start-provider", app, input: config }, 7_000);

  deliverEvent = async (
    app: PortableRunnerApp,
    event: Record<string, unknown>,
  ): Promise<unknown> =>
    this.request({ operation: "deliver-event", app, input: event }, 7_000);

  stats = async (): Promise<{
    runnerPid: number;
    loadedComponents: number;
    providerInstances: number;
    residentInstances: number;
  }> => this.request({ operation: "stats" }, 2_000);

  getLastObservation = (): PortableRunnerObservation | undefined =>
    this.lastObservation;

  stop = async (app: PortableRunnerApp): Promise<void> => {
    await this.request(
      {
        operation: "stop",
        app,
        input: { stoppedAt: new Date().toISOString(), reason: "host-stop" },
      },
      2_000,
    );
  };

  dispose = async (): Promise<void> => {
    const child = this.child;
    this.child = undefined;
    if (!child) return;
    child.stdin.end();
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 1_000);
      timeout.unref();
      child.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  };

  private request = async <T>(
    request: Omit<RunnerRequest, "requestId" | "app"> & {
      app?: PortableRunnerApp;
    },
    timeoutMs: number,
  ): Promise<T> => {
    const child = this.ensureChild();
    const requestId = randomUUID();
    const payload: RunnerRequest = {
      ...request,
      requestId,
      app: request.app ? this.toRunnerApp(request.app) : undefined,
    };
    return await new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const pending = this.pending.get(requestId);
        if (!pending) return;
        this.pending.delete(requestId);
        pending.reject(new PortableServiceRunnerError(
          "PORTABLE_RUNTIME_TIMEOUT",
          `Portable runner control request exceeded its ${timeoutMs}ms execution budget.`,
        ));
      }, timeoutMs);
      timeout.unref();
      this.pending.set(requestId, {
        resolve: (value) => resolve(value as T),
        reject,
        timeout,
        startedAt: Date.now(),
        operation: request.operation,
        appId: request.app?.id,
      });
      child.stdin.write(`${JSON.stringify(payload)}\n`, (error) => {
        if (!error) return;
        const pending = this.pending.get(requestId);
        if (!pending) return;
        clearTimeout(pending.timeout);
        this.pending.delete(requestId);
        reject(error);
      });
    });
  };

  private ensureChild = (): ChildProcessByStdio<
    Writable,
    Readable,
    Readable
  > => {
    if (this.child && this.child.exitCode === null) return this.child;
    const command = this.resolveRunnerPath();
    // The runner receives only its JSON control channel. In particular, do
    // not inherit the kernel's provider environment into a process that hosts
    // untrusted portable Components.
    const child = spawn(command, [], {
      stdio: ["pipe", "pipe", "pipe"],
      env: this.runnerEnvironment(),
    });
    this.child = child;
    this.stderrTail = [];
    const lines = createInterface({ input: child.stdout });
    lines.on("line", this.handleLine);
    child.stderr.on("data", (chunk: Buffer) => {
      const message = chunk.toString("utf8").trim();
      if (!message) return;
      this.stderrTail = [...this.stderrTail, message].slice(-20);
      process.stderr.write(`${message}\n`);
    });
    child.stdin.on("error", (error) => {
      if (this.child !== child) return;
      this.handleChildFailure(
        new PortableServiceRunnerError(
          "PORTABLE_RUNNER_IO_FAILED",
          `Portable runner input failed: ${error.message}. ${this.stderrTail.join(" ")}`.trim(),
        ),
      );
    });
    child.once("error", (error) => {
      if (this.child === child) this.handleChildFailure(error);
    });
    child.once("exit", (code, signal) => {
      if (this.child !== child) return;
      this.child = undefined;
      const error = new PortableServiceRunnerError(
        "PORTABLE_RUNNER_EXITED",
        `Portable runner exited (${signal ?? code ?? "unknown"}). ${this.stderrTail.join(" ")}`.trim(),
      );
      this.failAll(error);
      this.params.onUnexpectedExit?.(error);
    });
    return child;
  };

  private handleLine = (line: string): void => {
    let output: RunnerOutput;
    try {
      output = JSON.parse(line) as RunnerOutput;
    } catch {
      this.handleChildFailure(
        new Error(`Portable runner returned invalid JSON: ${line}`),
      );
      return;
    }
    if (output.protocolVersion !== PORTABLE_RUNNER_PROTOCOL_VERSION) {
      const received = output.protocolVersion ?? "missing";
      const error = new PortableServiceRunnerError(
        "PORTABLE_RUNNER_PROTOCOL_MISMATCH",
        `Portable runner protocol mismatch: expected ${PORTABLE_RUNNER_PROTOCOL_VERSION}, received ${received}.`,
      );
      const child = this.child;
      this.handleChildFailure(error);
      child?.kill("SIGKILL");
      return;
    }
    if ("kind" in output && output.kind === "host-call-request") {
      this.handleHostCall(output as PortableRunnerHostCallRequest);
      return;
    }
    if ("kind" in output && output.kind && output.kind !== "response") {
      this.handleJobEvent(output as PortableRunnerJobEvent);
      return;
    }
    const response = output as RunnerResponse;
    const pending = this.pending.get(response.requestId);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pending.delete(response.requestId);
    const childPid = this.child?.pid ?? null;
    this.lastObservation = {
      operation: pending.operation,
      appId: pending.appId,
      durationMs: Date.now() - pending.startedAt,
      runnerPid: childPid,
      memory:
        childPid === null
          ? { rssBytes: null, pssBytes: null }
          : readExtensionProcessMemory(childPid),
      logs: [...this.stderrTail],
    };
    if (response.ok) {
      pending.resolve(response.result);
      return;
    }
    pending.reject(
      new PortableServiceRunnerError(
        response.error?.code ?? "PORTABLE_RUNTIME_FAILED",
        response.error?.message ?? "Portable runner request failed.",
        this.stderrTail.length > 0 ? { logs: [...this.stderrTail] } : undefined,
      ),
    );
  };

  private handleChildFailure = (error: Error): void => {
    this.failAll(error);
    this.failJobs(error);
    this.child = undefined;
  };

  private failAll = (error: Error): void => {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  };

  private handleJobEvent = (event: PortableRunnerJobEvent): void => {
    const job = this.jobs.get(event.jobId);
    if (!job) return;
    for (const callback of job.callbacks) callback(event);
    if (event.kind !== "job-terminal" || job.settled) return;
    job.settled = true;
    for (const controller of job.hostCalls.values()) {
      controller.abort(new Error("Portable Job reached a terminal state."));
    }
    job.hostCalls.clear();
    this.jobs.delete(event.jobId);
    if (event.status === "succeeded") {
      job.resolve(event.result);
      return;
    }
    job.reject(new PortableServiceRunnerError(
      event.error?.code ?? `PORTABLE_JOB_${event.status.toUpperCase().replaceAll("-", "_")}`,
      event.error?.message ?? `Portable Job ${event.jobId} ${event.status}.`,
    ));
  };

  private waitForJob = async (
    jobId: string,
    result: Promise<unknown>,
    timeoutMs: number,
  ): Promise<unknown> => await new Promise<unknown>((resolve, reject) => {
    const timeout = setTimeout(() => {
      void this.cancelJob(jobId, "timeout").catch(() => undefined);
      reject(new PortableServiceRunnerError(
        "PORTABLE_RUNTIME_TIMEOUT",
        `Portable component exceeded its ${timeoutMs}ms execution budget.`,
      ));
    }, timeoutMs);
    timeout.unref();
    void result.then(
      (value) => { clearTimeout(timeout); resolve(value); },
      (error) => { clearTimeout(timeout); reject(error); },
    );
  });

  private failJobs = (error: Error): void => {
    for (const job of this.jobs.values()) {
      for (const controller of job.hostCalls.values()) controller.abort(error);
      if (!job.settled) job.reject(error);
    }
    this.jobs.clear();
  };

  private handleHostCall = (request: PortableRunnerHostCallRequest): void => {
    const job = this.jobs.get(request.jobId);
    if (!job) {
      void this.resolveHostCall(request.hostCallId, undefined, {
        code: "HOST_CALL_JOB_NOT_FOUND",
        message: "The enclosing Job is no longer active.",
      });
      return;
    }
    const controller = new AbortController();
    job.hostCalls.set(request.hostCallId, controller);
    void (async () => {
      try {
        if (!job.hostCall) {
          throw new PortableServiceRunnerError(
            "AI_CAPABILITY_UNAVAILABLE",
            "The NextClaw host did not register an AI capability callback for this Job.",
          );
        }
        const result = await job.hostCall(request, controller.signal);
        if (!this.jobs.has(request.jobId) || controller.signal.aborted) return;
        const bytes = Buffer.byteLength(JSON.stringify(result), "utf8");
        if (bytes > 64 * 1024) {
          throw new PortableServiceRunnerError(
            "HOST_CALL_OUTPUT_TOO_LARGE",
            "The host callback response exceeded 64 KiB.",
          );
        }
        await this.resolveHostCall(request.hostCallId, result);
      } catch (error) {
        if (!this.jobs.has(request.jobId) || controller.signal.aborted) return;
        await this.resolveHostCall(request.hostCallId, undefined, this.toHostCallError(error));
      } finally {
        this.jobs.get(request.jobId)?.hostCalls.delete(request.hostCallId);
      }
    })();
  };

  private resolveHostCall = async (
    hostCallId: string,
    result?: unknown,
    error?: { code: string; message: string },
  ): Promise<void> => {
    try {
      await this.request(
        {
          operation: "resolve-host-call",
          hostCallId,
          hostCallResult: error ? undefined : result,
          hostCallError: error,
        },
        7_000,
      );
    } catch {
      // A terminal/cancelled Job removes the runner-side pending callback.
      // Its Job terminal event remains the authoritative outcome.
    }
  };

  private abortHostCalls = (jobId: string, reason: Error): void => {
    const job = this.jobs.get(jobId);
    if (!job) return;
    for (const controller of job.hostCalls.values()) controller.abort(reason);
    job.hostCalls.clear();
  };

  private toHostCallError = (error: unknown): { code: string; message: string } => {
    if (error instanceof PortableServiceRunnerError) {
      return { code: error.code, message: error.message };
    }
    // Provider/Agent failures can include upstream payloads. They must never
    // become a Guest-visible channel for credentials or raw provider logs.
    return {
      code: "HOST_CALL_FAILED",
      message: "The NextClaw host capability call failed.",
    };
  };

  private toRunnerApp = (
    app: PortableRunnerApp,
  ): NonNullable<RunnerRequest["app"]> => ({
    id: app.id,
    componentPath: app.componentPath,
    dataDirectory: app.dataDirectory,
    allowedDomains: app.permissions.allowedDomains ?? [],
    allowedProviderIds: app.providerIds ?? [],
    storageEnabled: Boolean(app.permissions.storage),
    fileMounts: app.fileMounts,
    secretVariables: app.secretVariables,
    secretFingerprints: app.secretFingerprints,
  });

  private resolveRunnerPath = (): string => {
    const env = this.params.env ?? process.env;
    const devOverride = env.NEXTCLAW_WASMTIME_RUNNER_PATH?.trim();
    const runnerPath = devOverride || this.params.runnerPath?.trim();
    if (!runnerPath) {
      throw new PortableServiceRunnerError(
        "PORTABLE_RUNNER_UNAVAILABLE",
        "Portable runner is not part of this NextClaw distribution. Build the product runtime resource; runner developers may set NEXTCLAW_WASMTIME_RUNNER_PATH explicitly.",
      );
    }
    try {
      accessSync(
        runnerPath,
        process.platform === "win32" ? constants.F_OK : constants.X_OK,
      );
    } catch {
      throw new PortableServiceRunnerError(
        "PORTABLE_RUNNER_UNAVAILABLE",
        `Portable runner is missing or not executable: ${runnerPath}`,
      );
    }
    return runnerPath;
  };

  private runnerEnvironment = (): NodeJS.ProcessEnv => {
    const source = this.params.env ?? process.env;
    return Object.fromEntries(
      ["PATH", "SystemRoot", "WINDIR", "TEMP", "TMP", "TMPDIR"]
        .filter((key) => source[key] !== undefined)
        .map((key) => [key, source[key]]),
    );
  };
}
