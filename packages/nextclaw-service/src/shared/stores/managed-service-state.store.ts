import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getRunPath } from "@nextclaw/core";
import type { RemoteRuntimeState } from "@nextclaw/remote";

export type ManagedServiceLease = {
  ownerPid: number;
  heartbeatAt: string;
  heartbeatIntervalMs: number;
  ttlMs: number;
};

type ManagedServiceExitReason =
  | "exit"
  | "signal"
  | "uncaughtException";

export type ManagedServiceLastExit = {
  pid: number;
  reason: ManagedServiceExitReason;
  exitedAt: string;
  code?: number | null;
  signal?: string | null;
  message?: string | null;
};

export type ManagedServiceState = {
  pid: number;
  startedAt: string;
  uiUrl: string;
  apiUrl: string;
  uiHost?: string;
  uiPort?: number;
  logPath: string;
  startupState?: "ready" | "degraded";
  startupLastProbeError?: string | null;
  startupTimeoutMs?: number;
  startupCheckedAt?: string;
  lease?: ManagedServiceLease;
  lastExit?: ManagedServiceLastExit;
  remote?: RemoteRuntimeState;
};

export class ManagedServiceStateStore {
  get path(): string {
    return resolve(getRunPath(), "service.json");
  }

  readonly read = (): ManagedServiceState | null => {
    if (!existsSync(this.path)) {
      return null;
    }
    try {
      const raw = readFileSync(this.path, "utf-8");
      return JSON.parse(raw) as ManagedServiceState;
    } catch {
      return null;
    }
  };

  readonly write = (state: ManagedServiceState): void => {
    mkdirSync(resolve(this.path, ".."), { recursive: true });
    writeFileSync(this.path, JSON.stringify(state, null, 2));
  };

  readonly update = (updater: (state: ManagedServiceState) => ManagedServiceState): ManagedServiceState | null => {
    const current = this.read();
    if (!current) {
      return null;
    }
    const next = updater(current);
    this.write(next);
    return next;
  };

  readonly clear = (): void => {
    if (existsSync(this.path)) {
      rmSync(this.path, { force: true });
    }
  };

  readonly clearIfOwnedByProcess = (pid = process.pid): void => {
    if (this.read()?.pid === pid) {
      this.clear();
    }
  };
}

export const managedServiceStateStore = new ManagedServiceStateStore();
