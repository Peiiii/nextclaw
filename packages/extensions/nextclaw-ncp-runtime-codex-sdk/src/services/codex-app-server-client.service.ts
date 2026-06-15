import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { statSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import type { CodexOptions } from "@openai/codex-sdk";
import { buildCodexCliEnv } from "@/codex-cli-env.js";
import type {
  AppServerNotification,
  CodexAppServerNcpAgentRuntimeConfig,
  JsonObject,
} from "@/types/codex-app-server-runtime.types.js";

type CodexAppServerMessage =
  | { id: number; result?: unknown; error?: { code: number; message: string; data?: unknown } }
  | { method: string; params?: unknown };

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

class AsyncNotificationQueue {
  private readonly values: AppServerNotification[] = [];
  private readonly waiters: Array<(value: IteratorResult<AppServerNotification>) => void> = [];
  private closed = false;

  push = (value: AppServerNotification): void => {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter({ done: false, value });
      return;
    }
    this.values.push(value);
  };

  close = (): void => {
    this.closed = true;
    for (const waiter of this.waiters.splice(0)) {
      waiter({ done: true, value: undefined });
    }
  };

  next = async (): Promise<IteratorResult<AppServerNotification>> => {
    const value = this.values.shift();
    if (value) {
      return { done: false, value };
    }
    if (this.closed) {
      return { done: true, value: undefined };
    }
    return new Promise((resolve) => this.waiters.push(resolve));
  };
}

export class CodexAppServerClient {
  private child: ChildProcessWithoutNullStreams | null = null;
  private nextRequestId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly notifications = new AsyncNotificationQueue();
  private stderr = "";

  constructor(private readonly config: CodexAppServerNcpAgentRuntimeConfig) {}

  initialize = async (): Promise<void> => {
    this.startProcess();
    await this.request("initialize", {
      clientInfo: {
        name: "nextclaw",
        title: "NextClaw",
        version: "0.0.0",
      },
      capabilities: { experimentalApi: true },
    });
    this.notify("initialized", {});
  };

  request = async <T = unknown>(
    method: string,
    params: JsonObject,
    timeoutMs = 30000,
  ): Promise<T> => {
    const child = this.ensureProcess();
    const id = this.nextRequestId;
    this.nextRequestId += 1;
    const promise = new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex app-server request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timer,
      });
    });
    child.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
    return promise;
  };

  notify = (method: string, params: JsonObject): void => {
    this.ensureProcess().stdin.write(`${JSON.stringify({ method, params })}\n`);
  };

  nextNotification = (): Promise<IteratorResult<AppServerNotification>> =>
    this.notifications.next();

  dispose = (): void => {
    for (const [id, pending] of this.pending.entries()) {
      clearTimeout(pending.timer);
      pending.reject(new Error(`Codex app-server request ${id} was interrupted.`));
    }
    this.pending.clear();
    this.notifications.close();
    this.child?.kill("SIGTERM");
    this.child = null;
  };

  private startProcess = (): void => {
    if (this.child) {
      return;
    }
    const resolved = this.resolveCodexExecutable();
    const args = ["app-server", "--stdio"];
    for (const override of serializeConfigOverrides(this.config.cliConfig)) {
      args.push("--config", override);
    }
    if (this.config.apiBase?.trim()) {
      args.push(
        "--config",
        `openai_base_url=${toTomlValue(this.config.apiBase.trim(), "openai_base_url")}`,
      );
    }
    const env = buildCodexCliEnv(this.config) ?? {};
    if (this.config.apiKey.trim()) {
      env.CODEX_API_KEY = this.config.apiKey.trim();
    }
    this.prependCodexPathDirs(env, resolved.pathDirs);
    this.child = spawn(resolved.executablePath, args, { env });
    this.child.stderr.on("data", (data) => this.captureStderr(data.toString()));
    this.child.once("error", (error) => {
      this.rejectAll(error);
      this.notifications.close();
    });
    this.child.once("exit", (code, signal) => this.handleExit(code, signal));
    const rl = createInterface({ input: this.child.stdout, crlfDelay: Infinity });
    rl.on("line", (line) => this.handleLine(line));
    rl.once("close", () => this.notifications.close());
  };

  private ensureProcess = (): ChildProcessWithoutNullStreams => {
    if (!this.child) {
      throw new Error("Codex app-server is not running.");
    }
    return this.child;
  };

  private handleLine = (line: string): void => {
    if (!line.trim()) {
      return;
    }
    let message: CodexAppServerMessage;
    try {
      message = JSON.parse(line) as CodexAppServerMessage;
    } catch {
      return;
    }
    if ("id" in message) {
      this.handleResponse(message);
      return;
    }
    this.notifications.push({
      method: message.method,
      params: isJsonObject(message.params) ? message.params : {},
    });
  };

  private handleResponse = (
    message: Extract<CodexAppServerMessage, { id: number }>,
  ): void => {
    const pending = this.pending.get(message.id);
    if (!pending) {
      return;
    }
    clearTimeout(pending.timer);
    this.pending.delete(message.id);
    if (message.error) {
      pending.reject(new Error(message.error.message));
      return;
    }
    pending.resolve(message.result);
  };

  private handleExit = (code: number | null, signal: NodeJS.Signals | null): void => {
    const detail = signal ? `signal ${signal}` : `code ${code ?? 1}`;
    this.rejectAll(
      new Error(`Codex app-server exited with ${detail}: ${this.stderr.slice(-4000)}`),
    );
    this.notifications.close();
    this.child = null;
  };

  private captureStderr = (chunk: string): void => {
    this.stderr += chunk;
    if (this.stderr.length > 20000) {
      this.stderr = this.stderr.slice(-12000);
    }
  };

  private rejectAll = (error: Error): void => {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  };

  private resolveCodexExecutable = (): { executablePath: string; pathDirs: string[] } => {
    if (this.config.codexPathOverride?.trim()) {
      return { executablePath: this.config.codexPathOverride.trim(), pathDirs: [] };
    }
    const codexSdkEntry = fileURLToPath(import.meta.resolve("@openai/codex-sdk"));
    const codexSdkRoot = dirname(dirname(codexSdkEntry));
    const localBin = join(codexSdkRoot, "node_modules", ".bin", binaryName());
    if (isFile(localBin)) {
      return { executablePath: localBin, pathDirs: [] };
    }
    throw new Error("Unable to locate Codex app-server binary from @openai/codex-sdk.");
  };

  private prependCodexPathDirs = (env: Record<string, string>, pathDirs: string[]): void => {
    if (pathDirs.length === 0) {
      return;
    }
    const key = process.platform === "win32" ? "Path" : "PATH";
    const existing = (env[key] ?? "").split(delimiter).filter(Boolean);
    env[key] = [...pathDirs, ...existing.filter((entry) => !pathDirs.includes(entry))].join(delimiter);
  };
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function serializeConfigOverrides(configOverrides: CodexOptions["config"] | undefined): string[] {
  if (!configOverrides) {
    return [];
  }
  return flattenConfigOverrides(configOverrides, "");
}

function flattenConfigOverrides(value: unknown, prefix: string): string[] {
  if (!isJsonObject(value)) {
    if (!prefix) {
      throw new Error("Codex config overrides must be a plain object.");
    }
    return [`${prefix}=${toTomlValue(value, prefix)}`];
  }
  const entries = Object.entries(value);
  if (prefix && entries.length === 0) {
    return [`${prefix}={}`];
  }
  const overrides: string[] = [];
  for (const [key, child] of entries) {
    if (child === undefined) {
      continue;
    }
    const path = prefix ? `${prefix}.${key}` : key;
    if (isJsonObject(child)) {
      overrides.push(...flattenConfigOverrides(child, path));
    } else {
      overrides.push(`${path}=${toTomlValue(child, path)}`);
    }
  }
  return overrides;
}

function toTomlValue(value: unknown, path: string): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item, index) => toTomlValue(item, `${path}[${index}]`)).join(", ")}]`;
  }
  if (isJsonObject(value)) {
    return `{${Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .map(([key, child]) => `${formatTomlKey(key)} = ${toTomlValue(child, `${path}.${key}`)}`)
      .join(", ")}}`;
  }
  throw new Error(`Unsupported Codex config override value at ${path}.`);
}

const TOML_BARE_KEY = /^[A-Za-z0-9_-]+$/;

function formatTomlKey(key: string): string {
  return TOML_BARE_KEY.test(key) ? key : JSON.stringify(key);
}

function binaryName(): string {
  return process.platform === "win32" ? "codex.exe" : "codex";
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}
