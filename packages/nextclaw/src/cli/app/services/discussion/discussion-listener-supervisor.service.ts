import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { open } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { DiscussionListenerConfig } from "@nextclaw-cli/cli/app/stores/discussion/discussion-listener-state.store.js";
import { DiscussionListenerStateStore } from "@nextclaw-cli/cli/app/stores/discussion/discussion-listener-state.store.js";

export type DiscussionListenerStatus = {
  state: "running" | "stopped" | "degraded";
  pid?: number;
  startedAt?: string;
  heartbeatAt?: string;
  lastScanAt?: string;
  lastEventId?: string;
  lastError?: string;
  logPath: string;
};

export class DiscussionListenerSupervisorService {
  constructor(
    private readonly store = new DiscussionListenerStateStore(),
    private readonly launcher = process.argv[1]
  ) {}

  start = async (): Promise<DiscussionListenerStatus> => {
    const config = await this.store.readConfig();
    const current = await this.status(config);
    if (current.state === "running") return current;
    if (current.state === "degraded") await this.stop();
    if (!this.launcher)
      throw new Error("Unable to locate the NextClaw CLI launcher.");
    const instanceId = randomUUID();
    const log = await open(this.store.logPath, "a", 0o600);
    const child = spawn(
      process.execPath,
      [this.launcher, "discussion", "listen", "worker"],
      {
        detached: true,
        stdio: ["ignore", log.fd, log.fd],
        env: {
          ...process.env,
          NEXTCLAW_DISCUSSION_LISTENER_INSTANCE_ID: instanceId,
          NEXTCLAW_DISCUSSION_STATE_DIRECTORY: this.store.root,
        },
      }
    );
    await new Promise<void>((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });
    child.unref();
    await log.close();
    if (!child.pid)
      throw new Error("Discussion listener did not return a process ID.");
    const now = new Date().toISOString();
    await this.store.writeRuntime({
      instanceId,
      pid: child.pid,
      startedAt: now,
      heartbeatAt: now,
    });
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const status = await this.status(config);
      if (status.state === "running" && status.lastScanAt) {
        if (status.lastError) {
          await this.stop();
          throw new Error(`Discussion listener first scan failed: ${status.lastError}`);
        }
        return status;
      }
      if (status.state === "stopped") break;
    }
    const status = await this.status(config);
    await this.stop();
    throw new Error(
      `Discussion listener did not complete its first scan. Check ${
        status.logPath
      }${status.lastError ? `: ${status.lastError}` : "."}`
    );
  };

  status = async (
    knownConfig?: DiscussionListenerConfig
  ): Promise<DiscussionListenerStatus> => {
    const runtime = await this.store.readRuntime();
    if (!runtime) return { state: "stopped", logPath: this.store.logPath };
    let alive = true;
    try {
      process.kill(runtime.pid, 0);
    } catch {
      alive = false;
    }
    const owned =
      !alive || process.platform === "win32"
        ? alive
        : await this.isOwnedProcess(runtime.pid);
    const config =
      knownConfig ?? (await this.store.readConfig().catch(() => null));
    const freshForMs = Math.max(
      45_000,
      (config?.intervalMs ?? 30_000) * 2 + 15_000
    );
    const fresh = Date.now() - Date.parse(runtime.heartbeatAt) <= freshForMs;
    return {
      state:
        alive && owned && fresh
          ? "running"
          : alive && owned
          ? "degraded"
          : "stopped",
      pid: runtime.pid,
      startedAt: runtime.startedAt,
      heartbeatAt: runtime.heartbeatAt,
      lastScanAt: runtime.lastScanAt,
      lastEventId: runtime.lastEventId,
      lastError: runtime.lastError,
      logPath: this.store.logPath,
    };
  };

  stop = async (): Promise<DiscussionListenerStatus> => {
    const status = await this.status();
    if (!status.pid || status.state === "stopped") {
      await this.store.clearRuntime();
      return { state: "stopped", logPath: this.store.logPath };
    }
    if (
      status.state === "degraded" &&
      !(await this.isOwnedProcess(status.pid))
    ) {
      throw new Error(
        `Refusing to stop PID ${status.pid}: it no longer matches the discussion listener process.`
      );
    }
    process.kill(status.pid, "SIGTERM");
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      try {
        process.kill(status.pid, 0);
      } catch {
        await this.store.clearRuntime();
        return { state: "stopped", logPath: this.store.logPath };
      }
    }
    process.kill(status.pid, "SIGKILL");
    await this.store.clearRuntime();
    return { state: "stopped", logPath: this.store.logPath };
  };

  restart = async (): Promise<DiscussionListenerStatus> => {
    await this.stop();
    return this.start();
  };

  private isOwnedProcess = async (pid: number): Promise<boolean> => {
    if (process.platform === "win32") return false;
    try {
      const { stdout } = await promisify(execFile)("ps", [
        "-p",
        String(pid),
        "-o",
        "command=",
      ]);
      return stdout.includes("discussion listen worker");
    } catch {
      return false;
    }
  };
}
