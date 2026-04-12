import { fork, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";

type RuntimeLogger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

type RuntimeServiceOptions = {
  logger: RuntimeLogger;
  scriptPath: string;
  runtimeEnv: NodeJS.ProcessEnv;
  startupTimeoutMs?: number;
  healthPath?: string;
};

type RuntimeProcessExitInfo = {
  code: number | null;
  signal: NodeJS.Signals | null;
  outputLines: string[];
};

type RuntimeCommandFailureParams = {
  label: string;
  code: number | null;
  signal: NodeJS.Signals | null;
  outputLines: string[];
};

export class RuntimeServiceProcess {
  private readonly startupTimeoutMs: number;
  private readonly healthPath: string;
  private child: ChildProcess | null = null;
  private port: number | null = null;
  private stablePort: number | null = null;
  private stopping = false;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private restartAttempt = 0;
  private outputLines: string[] = [];
  private suppressedRestartChild: ChildProcess | null = null;

  constructor(private readonly options: RuntimeServiceOptions) {
    this.startupTimeoutMs = options.startupTimeoutMs ?? 25_000;
    this.healthPath = options.healthPath ?? "/api/health";
  }

  start = async (): Promise<{ port: number; baseUrl: string }> => {
    if (this.child) {
      throw new Error("Runtime process already started.");
    }
    this.stopping = false;
    this.restartAttempt = 0;
    const port = this.stablePort ?? await pickFreePort();
    this.stablePort = port;
    return await this.startEmbeddedServe(port);
  };

  private startEmbeddedServe = async (port: number): Promise<{ port: number; baseUrl: string }> => {
    await this.ensureInitialized();
    this.options.logger.info(`[runtime] launching embedded serve with NEXTCLAW_HOME=${this.options.runtimeEnv.NEXTCLAW_HOME ?? ""}`);
    const child = fork(this.options.scriptPath, ["serve", "--ui-port", String(port)], {
      env: this.options.runtimeEnv,
      stdio: "pipe"
    });

    child.stdout?.on("data", (chunk) => {
      this.options.logger.info(`[runtime] ${String(chunk).trimEnd()}`);
      this.outputLines = rememberRuntimeCommandOutput(this.outputLines, String(chunk));
    });
    child.stderr?.on("data", (chunk) => {
      this.options.logger.warn(`[runtime] ${String(chunk).trimEnd()}`);
      this.outputLines = rememberRuntimeCommandOutput(this.outputLines, String(chunk));
    });
    child.once("exit", (code, signal) => {
      void this.handleChildExit(child, {
        code,
        signal,
        outputLines: [...this.outputLines]
      });
    });

    this.child = child;
    this.port = port;
    const baseUrl = `http://127.0.0.1:${port}`;
    try {
      await waitForHealth(`${baseUrl}${this.healthPath}`, this.startupTimeoutMs);
      this.restartAttempt = 0;
      return { port, baseUrl };
    } catch (error) {
      this.suppressedRestartChild = child;
      await this.terminateChild(child);
      if (this.child === child) {
        this.child = null;
        this.port = null;
      }
      throw error;
    }
  };

  private ensureInitialized = async (): Promise<void> => {
    this.options.logger.info(`[runtime] running bootstrap init with NEXTCLAW_HOME=${this.options.runtimeEnv.NEXTCLAW_HOME ?? ""}`);
    await this.runCliCommand(["init"], "init");
  };

  private runCliCommand = async (args: string[], label: string): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
      let outputLines: string[] = [];
      const child = fork(this.options.scriptPath, args, {
        env: this.options.runtimeEnv,
        stdio: "pipe"
      });

      child.stdout?.on("data", (chunk) => {
        const message = String(chunk).trimEnd();
        if (message) {
          this.options.logger.info(`[runtime:${label}] ${message}`);
          outputLines = rememberRuntimeCommandOutput(outputLines, message);
        }
      });
      child.stderr?.on("data", (chunk) => {
        const message = String(chunk).trimEnd();
        if (message) {
          this.options.logger.warn(`[runtime:${label}] ${message}`);
          outputLines = rememberRuntimeCommandOutput(outputLines, message);
        }
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
            formatRuntimeCommandFailureMessage({
              label,
              code,
              signal,
              outputLines
            })
          )
        );
      });
    });
  };

  stop = async (): Promise<void> => {
    this.stopping = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    const child = this.child;
    if (!child || child.killed) {
      this.child = null;
      this.port = null;
      return;
    }

    await this.terminateChild(child);
    this.child = null;
    this.port = null;
  };

  private terminateChild = async (child: ChildProcess): Promise<void> => {
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
  };

  private handleChildExit = async (child: ChildProcess, info: RuntimeProcessExitInfo): Promise<void> => {
    if (this.child === child) {
      this.child = null;
      this.port = null;
    }
    const suppressRestart = this.suppressedRestartChild === child;
    if (suppressRestart) {
      this.suppressedRestartChild = null;
    }
    const outputSummary = formatRecentRuntimeOutput(info.outputLines);
    if (outputSummary) {
      this.options.logger.warn(
        `[runtime] exited (code=${String(info.code)}, signal=${String(info.signal)}). Recent output:\n${outputSummary}`
      );
    } else {
      this.options.logger.warn(`[runtime] exited (code=${String(info.code)}, signal=${String(info.signal)})`);
    }
    if (this.stopping) {
      return;
    }
    if (suppressRestart) {
      return;
    }
    await this.scheduleRestart(info);
  };

  private scheduleRestart = async (info: RuntimeProcessExitInfo): Promise<void> => {
    if (this.restartTimer || this.stopping) {
      return;
    }
    this.restartAttempt += 1;
    const delayMs = computeRuntimeRestartDelayMs(this.restartAttempt);
    this.options.logger.warn(
      `[runtime] scheduling automatic recovery attempt ${this.restartAttempt} in ${delayMs}ms after unexpected exit (code=${String(info.code)}, signal=${String(info.signal)})`
    );
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      void this.restartInBackground();
    }, delayMs);
  };

  private restartInBackground = async (): Promise<void> => {
    if (this.stopping) {
      return;
    }
    const port = this.stablePort ?? await pickFreePort();
    this.stablePort = port;
    try {
      await this.startEmbeddedServe(port);
      this.options.logger.info(`[runtime] automatic recovery attempt ${this.restartAttempt} succeeded on port ${port}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.options.logger.error(`[runtime] automatic recovery attempt ${this.restartAttempt} failed: ${message}`);
      await this.scheduleRestart({
        code: null,
        signal: null,
        outputLines: [...this.outputLines, `Recovery failure: ${message}`]
      });
    }
  };
}

export function formatRuntimeCommandFailureMessage(params: RuntimeCommandFailureParams): string {
  const { code, label, outputLines, signal } = params;
  const header = `Runtime command failed: ${label} exited with code=${String(code)}, signal=${String(signal)}`;
  if (outputLines.length === 0) {
    return header;
  }
  return `${header}\n${outputLines.join("\n")}`;
}

function rememberRuntimeCommandOutput(outputLines: string[], chunk: string): string[] {
  const next = [...outputLines];
  for (const line of chunk.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    next.push(trimmed);
    if (next.length > 20) {
      next.shift();
    }
  }
  return next;
}

function formatRecentRuntimeOutput(outputLines: string[]): string {
  return outputLines
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-20)
    .join("\n");
}

export function computeRuntimeRestartDelayMs(attempt: number): number {
  const normalizedAttempt = Number.isFinite(attempt) ? Math.max(1, Math.floor(attempt)) : 1;
  return Math.min(15_000, 500 * (2 ** (normalizedAttempt - 1)));
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
