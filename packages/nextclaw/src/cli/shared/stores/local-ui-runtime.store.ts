import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDataDir, type Config } from "@nextclaw/core";
import type { RemoteRuntimeState } from "@nextclaw/remote";
import { resolveUiApiBase } from "../utils/cli.utils.js";

export type LocalUiRuntimeState = {
  pid: number;
  startedAt: string;
  uiUrl: string;
  apiUrl: string;
  uiHost?: string;
  uiPort?: number;
  remote?: RemoteRuntimeState;
};

export class LocalUiRuntimeStore {
  get path(): string {
    return resolve(getDataDir(), "run", "ui-runtime.json");
  }

  readonly read = (): LocalUiRuntimeState | null => {
    if (!existsSync(this.path)) {
      return null;
    }
    try {
      const raw = readFileSync(this.path, "utf-8");
      return JSON.parse(raw) as LocalUiRuntimeState;
    } catch {
      return null;
    }
  };

  readonly write = (state: LocalUiRuntimeState): void => {
    mkdirSync(resolve(this.path, ".."), { recursive: true });
    writeFileSync(this.path, JSON.stringify(state, null, 2));
  };

  readonly update = (updater: (state: LocalUiRuntimeState) => LocalUiRuntimeState): LocalUiRuntimeState | null => {
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

  readonly writeCurrentProcess = (
    uiConfig: Pick<Config["ui"], "host" | "port">,
    pid = process.pid
  ): LocalUiRuntimeState => {
    const existing = this.read();
    const uiUrl = resolveUiApiBase(uiConfig.host, uiConfig.port);
    const state: LocalUiRuntimeState = {
      pid,
      startedAt:
        existing?.pid === pid && typeof existing.startedAt === "string"
          ? existing.startedAt
          : new Date().toISOString(),
      uiUrl,
      apiUrl: `${uiUrl}/api`,
      uiHost: uiConfig.host,
      uiPort: uiConfig.port,
      ...(existing?.remote ? { remote: existing.remote } : {})
    };
    this.write(state);
    return state;
  };
}

export const localUiRuntimeStore = new LocalUiRuntimeStore();
