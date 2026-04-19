import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDataDir } from "@nextclaw/core";
import type { LlmUsageRecord } from "./llm-usage-record.js";

export type LlmUsageSnapshot = LlmUsageRecord;

export class LlmUsageSnapshotStore {
  constructor(private readonly explicitPath?: string) {}

  get path(): string {
    return this.explicitPath ?? resolve(getDataDir(), "run", "llm-usage.json");
  }

  readonly read = (): LlmUsageRecord | null => {
    if (!existsSync(this.path)) {
      return null;
    }
    try {
      const raw = readFileSync(this.path, "utf-8");
      return JSON.parse(raw) as LlmUsageRecord;
    } catch {
      return null;
    }
  };

  readonly write = (snapshot: LlmUsageRecord): void => {
    mkdirSync(resolve(this.path, ".."), { recursive: true });
    writeFileSync(this.path, JSON.stringify(snapshot, null, 2));
  };

  readonly clear = (): void => {
    if (existsSync(this.path)) {
      rmSync(this.path, { force: true });
    }
  };
}

export const llmUsageSnapshotStore = new LlmUsageSnapshotStore();
