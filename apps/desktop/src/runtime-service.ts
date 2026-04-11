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

  constructor(private readonly options: RuntimeServiceOptions) {
    this.startupTimeoutMs = options.startupTimeoutMs ?? 25_000;
    this.healthPath = options.healthPath ?? "/api/health";
  }

  start = async (): Promise<{ port: number; baseUrl: string }> => {
    if (this.child) {
      throw new Error("Runtime process already started.");
    }
    return await this.startEmbeddedServe();
  };

  private startEmbeddedServe = async (): Promise<{ port: number; baseUrl: string }> => {
    await this.ensureInitialized();
    const port = await pickFreePort();
    this.options.logger.info(`[runtime] launching embedded serve with NEXTCLAW_HOME=${this.options.runtimeEnv.NEXTCLAW_HOME ?? ""}`);
    const child = fork(this.options.scriptPath, ["serve", "--ui-port", String(port)], {
      env: this.options.runtimeEnv,
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
