import { fork, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

type RuntimeLogger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

type RuntimeServiceOptions = {
  logger: RuntimeLogger;
  scriptPath: string;
  startupTimeoutMs?: number;
  healthPath?: string;
  mode?: "managed-service" | "embedded-serve";
};

type ServiceState = {
  uiUrl?: unknown;
  uiHost?: unknown;
  uiPort?: unknown;
};

const LOOPBACK_HOST = "127.0.0.1";

export class RuntimeServiceProcess {
  private readonly startupTimeoutMs: number;
  private readonly healthPath: string;
  private readonly mode: "managed-service" | "embedded-serve";
  private child: ChildProcess | null = null;
  private port: number | null = null;

  constructor(private readonly options: RuntimeServiceOptions) {
    this.startupTimeoutMs = options.startupTimeoutMs ?? 25_000;
    this.healthPath = options.healthPath ?? "/api/health";
    this.mode = options.mode ?? "embedded-serve";
  }

  start = async (): Promise<{ port: number; baseUrl: string }> => {
    if (this.child) {
      throw new Error("Runtime process already started.");
    }
    if (this.mode === "managed-service") {
      return await this.startManagedService();
    }
    return await this.startEmbeddedServe();
  };

  private startManagedService = async (): Promise<{ port: number; baseUrl: string }> => {
    await this.ensureInitialized();
    await this.runCliCommand(["start"], "start");
    const state = this.readServiceState();
    const baseUrl = resolveManagedUiBaseUrlFromState(state);
    if (!baseUrl) {
      throw new Error(`Managed runtime is running but UI host/port is unavailable in ${this.resolveServiceStatePath()}`);
    }
    const parsedPort = this.parsePort(baseUrl);
    this.port = parsedPort;
    return { port: parsedPort ?? 0, baseUrl };
  };

  private startEmbeddedServe = async (): Promise<{ port: number; baseUrl: string }> => {
    await this.ensureInitialized();
    const port = await pickFreePort();
    const child = fork(this.options.scriptPath, ["serve", "--ui-port", String(port)], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1"
      },
      stdio: "pipe"
    });

    child.stdout?.on("data", (chunk) => {
      this.options.logger.info(`[runtime] ${String(chunk).trimEnd()}`);
    });
    child.stderr?.on("data", (chunk) => {
      this.options.logger.warn(`[runtime] ${String(chunk).trimEnd()}`);
    });
    child.once("exit", (code, signal) => {
      this.options.logger.warn(`[runtime] exited (code=${String(code)}, signal=${String(signal)})`);
      this.child = null;
      this.port = null;
    });

    this.child = child;
    this.port = port;
    const baseUrl = `http://127.0.0.1:${port}`;
    await waitForHealth(`${baseUrl}${this.healthPath}`, this.startupTimeoutMs);
    return { port, baseUrl };
  };

  private ensureInitialized = async (): Promise<void> => {
    this.options.logger.info("[runtime] running bootstrap init");
    await this.runCliCommand(["init"], "init");
  };

  private runCliCommand = async (args: string[], label: string): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
      const child = fork(this.options.scriptPath, args, {
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: "1"
        },
        stdio: "pipe"
      });

      child.stdout?.on("data", (chunk) => {
        this.options.logger.info(`[runtime:${label}] ${String(chunk).trimEnd()}`);
      });
      child.stderr?.on("data", (chunk) => {
        this.options.logger.warn(`[runtime:${label}] ${String(chunk).trimEnd()}`);
      });

      child.once("error", (error) => {
        reject(error);
      });
      child.once("exit", (code, signal) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(
          new Error(
            `Runtime command failed: ${label} exited with code=${String(code)}, signal=${String(signal)}`
          )
        );
      });
    });
  };

  stop = async (): Promise<void> => {
    if (this.mode === "managed-service") {
      this.child = null;
      this.port = null;
      return;
    }

    const child = this.child;
    if (!child || child.killed) {
      this.child = null;
      this.port = null;
      return;
    }

    await new Promise<void>((resolve) => {
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      child.once("exit", () => settle());
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!settled) {
          child.kill("SIGKILL");
          settle();
        }
      }, 5_000);
    });

    this.child = null;
    this.port = null;
  };

  private readServiceState = (): ServiceState | null => {
    const statePath = this.resolveServiceStatePath();
    if (!existsSync(statePath)) {
      return null;
    }
    try {
      const parsed = JSON.parse(readFileSync(statePath, "utf8"));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return null;
      }
      return parsed as ServiceState;
    } catch {
      return null;
    }
  };

  private resolveServiceStatePath = (): string => {
    const homeOverride = process.env.NEXTCLAW_HOME?.trim();
    const dataDir = homeOverride ? resolve(homeOverride) : resolve(homedir(), ".nextclaw");
    return resolve(dataDir, "run", "service.json");
  };

  private parsePort = (baseUrl: string): number | null => {
    try {
      const parsed = new URL(baseUrl);
      const explicitPort = Number(parsed.port);
      if (Number.isFinite(explicitPort) && explicitPort > 0) {
        return explicitPort;
      }
      if (parsed.protocol === "http:") {
        return 80;
      }
      if (parsed.protocol === "https:") {
        return 443;
      }
      return null;
    } catch {
      return null;
    }
  };
}

export function resolveManagedUiBaseUrlFromState(state: ServiceState | null): string | null {
  const fromUrl = resolveManagedUiUrl(state);
  if (fromUrl) {
    return fromUrl;
  }
  const uiHost = typeof state?.uiHost === "string" ? state.uiHost.trim() : "";
  const uiPort = toManagedPort(state?.uiPort);
  if (!uiPort) {
    return null;
  }
  const resolvedHost = resolveManagedUiHost(uiHost);
  if (!resolvedHost) {
    return null;
  }
  return `http://${resolvedHost}:${uiPort}`;
}

function resolveManagedUiUrl(state: ServiceState | null): string | null {
  const uiUrl = typeof state?.uiUrl === "string" ? state.uiUrl.trim() : "";
  if (!uiUrl) {
    return null;
  }
  try {
    const parsed = new URL(uiUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    const resolvedHost = resolveManagedUiHost(parsed.hostname);
    const resolvedPort = parsed.port ? toManagedPort(parsed.port) : parsed.protocol === "http:" ? 80 : 443;
    if (!resolvedHost || !resolvedPort) {
      return null;
    }
    return `${parsed.protocol}//${resolvedHost}:${resolvedPort}`;
  } catch {
    return null;
  }
}

function resolveManagedUiHost(uiHost: string): string | null {
  if (!uiHost || isLoopbackHost(uiHost) || isWildcardHost(uiHost)) {
    return LOOPBACK_HOST;
  }
  return uiHost;
}

function toManagedPort(value: unknown): number | null {
  const uiPort = Number(value);
  if (!Number.isFinite(uiPort) || uiPort <= 0) {
    return null;
  }
  return uiPort;
}

function isLoopbackHost(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "127.0.0.1" || normalized === "localhost" || normalized === "::1";
}

function isWildcardHost(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "0.0.0.0" || normalized === "::";
}

export async function waitForHealth(url: string, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  let lastError: unknown = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok) {
        return;
      }
      lastError = new Error(`Unexpected status: ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(350);
  }
  throw new Error(`Runtime health check timeout: ${String(lastError ?? "unknown error")}`);
}

async function pickFreePort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Unable to allocate free port.")));
        return;
      }
      const port = address.port;
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve(port);
      });
    });
  });
}
