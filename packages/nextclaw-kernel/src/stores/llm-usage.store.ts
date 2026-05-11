import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { getDataDir } from "@nextclaw/core";
import type { LlmUsageRecord } from "@kernel/types/llm-usage.types.js";

export type LlmUsageStoreOptions = {
  snapshotPath?: string;
  historyPath?: string;
};

export class LlmUsageStore {
  constructor(private readonly options: LlmUsageStoreOptions = {}) {}

  get snapshotPath(): string {
    return this.options.snapshotPath ?? resolve(getDataDir(), "run", "llm-usage.json");
  }

  get historyPath(): string {
    return this.options.historyPath ?? resolve(getDataDir(), "logs", "llm-usage.jsonl");
  }

  readSnapshot = (): LlmUsageRecord | null => {
    if (!existsSync(this.snapshotPath)) {
      return null;
    }
    try {
      const raw = readFileSync(this.snapshotPath, "utf-8");
      return JSON.parse(raw) as LlmUsageRecord;
    } catch {
      return null;
    }
  };

  writeSnapshot = (snapshot: LlmUsageRecord): void => {
    mkdirSync(dirname(this.snapshotPath), { recursive: true });
    writeFileSync(this.snapshotPath, JSON.stringify(snapshot, null, 2));
  };

  clearSnapshot = (): void => {
    if (existsSync(this.snapshotPath)) {
      rmSync(this.snapshotPath, { force: true });
    }
  };

  listHistory = (): LlmUsageRecord[] => {
    if (!existsSync(this.historyPath)) {
      return [];
    }
    try {
      const raw = readFileSync(this.historyPath, "utf-8");
      return raw
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .flatMap((line) => {
          try {
            return [JSON.parse(line) as LlmUsageRecord];
          } catch {
            return [];
          }
        });
    } catch {
      return [];
    }
  };

  appendHistory = (record: LlmUsageRecord): void => {
    mkdirSync(dirname(this.historyPath), { recursive: true });
    appendFileSync(this.historyPath, `${JSON.stringify(record)}\n`);
  };

  clearHistory = (): void => {
    if (existsSync(this.historyPath)) {
      rmSync(this.historyPath, { force: true });
    }
  };
}
