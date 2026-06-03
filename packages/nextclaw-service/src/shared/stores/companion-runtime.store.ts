import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getRunPath } from "@nextclaw/core";

export type CompanionRuntimeState = {
  pid: number;
  startedAt: string;
  baseUrl: string;
};

export class CompanionRuntimeStore {
  get path(): string {
    return resolve(getRunPath(), "companion.json");
  }

  readonly read = (): CompanionRuntimeState | null => {
    if (!existsSync(this.path)) {
      return null;
    }
    try {
      return JSON.parse(readFileSync(this.path, "utf-8")) as CompanionRuntimeState;
    } catch {
      return null;
    }
  };

  readonly write = (state: CompanionRuntimeState): void => {
    mkdirSync(resolve(this.path, ".."), { recursive: true });
    writeFileSync(this.path, JSON.stringify(state, null, 2));
  };

  readonly clear = (): void => {
    if (existsSync(this.path)) {
      rmSync(this.path, { force: true });
    }
  };
}

export const companionRuntimeStore = new CompanionRuntimeStore();
