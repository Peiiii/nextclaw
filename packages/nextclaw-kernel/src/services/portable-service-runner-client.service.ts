import { spawn, type ChildProcessByStdio } from "node:child_process";
import { randomUUID } from "node:crypto";
import { accessSync, constants } from "node:fs";
import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import type { AppPermissions } from "@nextclaw/app-runtime";

export type PortableRunnerApp = {
  id: string;
  componentPath: string;
  dataDirectory: string;
  permissions: AppPermissions;
  providerIds?: string[];
};

export type PortableRunnerAction = {
  name: string;
  title: string;
  description: string;
};

type RunnerOperation =
  | "deliver-event"
  | "invoke"
  | "list-actions"
  | "start-provider"
  | "start-resident"
  | "stats"
  | "stop";

type RunnerRequest = {
  requestId: string;
  operation: RunnerOperation;
  app?: {
    id: string;
    componentPath: string;
    dataDirectory: string;
    allowedDomains: string[];
    allowedProviderIds: string[];
    storageEnabled: boolean;
  };
  actionName?: string;
  input?: Record<string, unknown>;
};

type RunnerResponse = {
  requestId: string;
  protocolVersion?: string;
  ok: boolean;
  result?: unknown;
  error?: { code?: string; message?: string };
};

const PORTABLE_RUNNER_PROTOCOL_VERSION = "0.1.0";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

export class PortableServiceRunnerError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PortableServiceRunnerError";
  }
}

export class PortableServiceRunnerClientService {
  private child?: ChildProcessByStdio<Writable, Readable, Readable>;
  private readonly pending = new Map<string, PendingRequest>();
  private stderrTail: string[] = [];

  constructor(private readonly params: {
    runnerPath?: string;
    env?: NodeJS.ProcessEnv;
    onUnexpectedExit?: (error: PortableServiceRunnerError) => void;
  } = {}) {}

  listActions = async (app: PortableRunnerApp): Promise<PortableRunnerAction[]> =>
    this.request<PortableRunnerAction[]>({ operation: "list-actions", app }, 7_000);

  invoke = async (
    app: PortableRunnerApp,
    actionName: string,
    input: Record<string, unknown>,
    timeoutMs = 7_000,
  ): Promise<unknown> => this.request({ operation: "invoke", app, actionName, input }, timeoutMs);

  startResident = async (
    app: PortableRunnerApp,
    config: Record<string, unknown>,
  ): Promise<unknown> => this.request({ operation: "start-resident", app, input: config }, 7_000);

  startProvider = async (
    app: PortableRunnerApp,
    config: Record<string, unknown>,
  ): Promise<unknown> => this.request({ operation: "start-provider", app, input: config }, 7_000);

  deliverEvent = async (
    app: PortableRunnerApp,
    event: Record<string, unknown>,
  ): Promise<unknown> => this.request({ operation: "deliver-event", app, input: event }, 7_000);

  stats = async (): Promise<{
    runnerPid: number;
    loadedComponents: number;
    providerInstances: number;
    residentInstances: number;
  }> =>
    this.request({ operation: "stats" }, 2_000);

  stop = async (app: PortableRunnerApp): Promise<void> => {
    await this.request({
      operation: "stop",
      app,
      input: { stoppedAt: new Date().toISOString(), reason: "host-stop" },
    }, 2_000);
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
    request: Omit<RunnerRequest, "requestId" | "app"> & { app?: PortableRunnerApp },
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
        const error = new PortableServiceRunnerError(
          "PORTABLE_RUNTIME_TIMEOUT",
          `Portable component exceeded its ${timeoutMs}ms execution budget.`,
        );
        this.failAll(error);
        this.child?.kill("SIGKILL");
        this.child = undefined;
      }, timeoutMs);
      timeout.unref();
      this.pending.set(requestId, {
        resolve: (value) => resolve(value as T),
        reject,
        timeout,
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

  private ensureChild = (): ChildProcessByStdio<Writable, Readable, Readable> => {
    if (this.child && this.child.exitCode === null) return this.child;
    const command = this.resolveRunnerPath();
    const child = spawn(command, [], { stdio: ["pipe", "pipe", "pipe"] });
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
      this.handleChildFailure(new PortableServiceRunnerError(
        "PORTABLE_RUNNER_IO_FAILED",
        `Portable runner input failed: ${error.message}. ${this.stderrTail.join(" ")}`.trim(),
      ));
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
    let response: RunnerResponse;
    try {
      response = JSON.parse(line) as RunnerResponse;
    } catch {
      this.handleChildFailure(new Error(`Portable runner returned invalid JSON: ${line}`));
      return;
    }
    if (response.protocolVersion !== PORTABLE_RUNNER_PROTOCOL_VERSION) {
      const received = response.protocolVersion ?? "missing";
      const error = new PortableServiceRunnerError(
        "PORTABLE_RUNNER_PROTOCOL_MISMATCH",
        `Portable runner protocol mismatch: expected ${PORTABLE_RUNNER_PROTOCOL_VERSION}, received ${received}.`,
      );
      const child = this.child;
      this.handleChildFailure(error);
      child?.kill("SIGKILL");
      return;
    }
    const pending = this.pending.get(response.requestId);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pending.delete(response.requestId);
    if (response.ok) {
      pending.resolve(response.result);
      return;
    }
    pending.reject(new PortableServiceRunnerError(
      response.error?.code ?? "PORTABLE_RUNTIME_FAILED",
      response.error?.message ?? "Portable runner request failed.",
    ));
  };

  private handleChildFailure = (error: Error): void => {
    this.failAll(error);
    this.child = undefined;
  };

  private failAll = (error: Error): void => {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  };

  private toRunnerApp = (app: PortableRunnerApp): NonNullable<RunnerRequest["app"]> => ({
    id: app.id,
    componentPath: app.componentPath,
    dataDirectory: app.dataDirectory,
    allowedDomains: app.permissions.allowedDomains ?? [],
    allowedProviderIds: app.providerIds ?? [],
    storageEnabled: Boolean(app.permissions.storage),
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
      accessSync(runnerPath, process.platform === "win32" ? constants.F_OK : constants.X_OK);
    } catch {
      throw new PortableServiceRunnerError(
        "PORTABLE_RUNNER_UNAVAILABLE",
        `Portable runner is missing or not executable: ${runnerPath}`,
      );
    }
    return runnerPath;
  };
}
