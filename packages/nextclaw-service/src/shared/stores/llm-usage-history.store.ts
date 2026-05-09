import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { getDataDir } from "@nextclaw/core";
import type { LlmUsageRecord } from "./llm-usage-record.js";

export class LlmUsageHistoryStore {
  constructor(private readonly explicitPath?: string) {}

  get path(): string {
    return this.explicitPath ?? resolve(getDataDir(), "logs", "llm-usage.jsonl");
  }

  readonly list = (): LlmUsageRecord[] => {
    if (!existsSync(this.path)) {
      return [];
    }
    try {
      const raw = readFileSync(this.path, "utf-8");
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

  readonly append = (record: LlmUsageRecord): void => {
    mkdirSync(resolve(this.path, ".."), { recursive: true });
    appendFileSync(this.path, `${JSON.stringify(record)}\n`);
  };

  readonly clear = (): void => {
    if (existsSync(this.path)) {
      rmSync(this.path, { force: true });
    }
  };
}

export const llmUsageHistoryStore = new LlmUsageHistoryStore();
