import type { UsageCommandOptions } from "@nextclaw-service/types/cli.types.js";
import {
  LlmUsageManager,
  type LlmUsageStats,
} from "@nextclaw/kernel";

export class LlmUsageCommandService {
  private readonly usageManager: LlmUsageManager;

  constructor(deps: {
    usageManager?: LlmUsageManager;
  } = {}) {
    this.usageManager = deps.usageManager ?? new LlmUsageManager();
  }

  readonly show = async (opts: UsageCommandOptions = {}): Promise<void> => {
    if (opts.history && opts.stats) {
      console.error("Choose only one usage mode: `--history` or `--stats`.");
      process.exitCode = 1;
      return;
    }
    if (opts.history) {
      this.showHistory(opts);
      return;
    }
    if (opts.stats) {
      this.showStats(opts);
      return;
    }
    this.showSnapshot(opts);
  };

  private readonly showSnapshot = (opts: UsageCommandOptions): void => {
    const snapshot = this.usageManager.getSnapshot();
    if (opts.json) {
      console.log(JSON.stringify({ ok: Boolean(snapshot), mode: "snapshot", path: this.usageManager.snapshotPath, snapshot }, null, 2));
      process.exitCode = 0;
      return;
    }
    if (!snapshot) {
      console.log([
        "No LLM usage snapshot recorded yet.",
        `Snapshot path: ${this.usageManager.snapshotPath}`,
        "Run `nextclaw agent -m \"ping\"` or use the local UI once, then retry `nextclaw usage`.",
      ].join("\n"));
      process.exitCode = 0;
      return;
    }
    console.log(this.renderSnapshot(snapshot));
    process.exitCode = 0;
  };

  private readonly showHistory = (opts: UsageCommandOptions): void => {
    const records = this.usageManager.getHistory(opts.limit);
    if (opts.json) {
      console.log(JSON.stringify({
        ok: records.length > 0,
        mode: "history",
        path: this.usageManager.historyPath,
        limit: this.usageManager.resolveHistoryLimit(opts.limit),
        records,
      }, null, 2));
      process.exitCode = 0;
      return;
    }
    if (records.length === 0) {
      console.log([
        "No LLM usage history recorded yet.",
        `History path: ${this.usageManager.historyPath}`,
        "Run `nextclaw agent -m \"ping\"` or use the local UI once, then retry `nextclaw usage --history`.",
      ].join("\n"));
      process.exitCode = 0;
      return;
    }
    console.log(this.renderHistory(records));
    process.exitCode = 0;
  };

  private readonly showStats = (opts: UsageCommandOptions): void => {
    const stats = this.usageManager.getStats();
    if (opts.json) {
      console.log(JSON.stringify({ ok: stats.totalRecords > 0, mode: "stats", path: this.usageManager.historyPath, stats }, null, 2));
      process.exitCode = 0;
      return;
    }
    if (stats.totalRecords === 0) {
      console.log([
        "No LLM usage history recorded yet.",
        `History path: ${this.usageManager.historyPath}`,
        "Run `nextclaw agent -m \"ping\"` or use the local UI once, then retry `nextclaw usage --stats`.",
      ].join("\n"));
      process.exitCode = 0;
      return;
    }
    console.log(this.renderStats(stats));
    process.exitCode = 0;
  };

  private readonly renderSnapshot = (snapshot: NonNullable<ReturnType<LlmUsageManager["getSnapshot"]>>): string => {
    const lines = [
      "Latest LLM usage snapshot",
      `Observed at: ${snapshot.observedAt}`,
      `Source: ${snapshot.source}`,
      `Model: ${snapshot.model ?? "unknown"}`,
      `Prompt tokens: ${snapshot.summary.promptTokens}`,
      `Completion tokens: ${snapshot.summary.completionTokens}`,
      `Total tokens: ${snapshot.summary.totalTokens}`,
      `Cached tokens: ${snapshot.summary.cachedTokens}`,
      `Cache hit: ${snapshot.summary.cacheHit ? "yes" : "no"}`,
      `Snapshot path: ${this.usageManager.snapshotPath}`,
    ];
    if (snapshot.summary.cacheMetricKeys.length > 0) {
      lines.push(`Cache metric keys: ${snapshot.summary.cacheMetricKeys.join(", ")}`);
    }
    if (Object.keys(snapshot.usage).length > 0) {
      lines.push("", "Raw usage:", JSON.stringify(snapshot.usage, null, 2));
    }
    return lines.join("\n");
  };

  private readonly renderHistory = (records: ReturnType<LlmUsageManager["getHistory"]>): string => {
    const lines = [
      "Recent LLM usage history",
      `History path: ${this.usageManager.historyPath}`,
      `Showing: ${records.length} record(s)`,
      "",
    ];
    for (const [index, record] of records.entries()) {
      lines.push(
        `${index + 1}. ${record.observedAt} | source=${record.source} | model=${record.model ?? "unknown"} | total=${record.summary.totalTokens} | cached=${record.summary.cachedTokens} | cache-hit=${record.summary.cacheHit ? "yes" : "no"}`
      );
    }
    return lines.join("\n");
  };

  private readonly renderStats = (stats: LlmUsageStats): string => {
    const lines = [
      "LLM usage history stats",
      `History path: ${this.usageManager.historyPath}`,
      `Records: ${stats.totalRecords}`,
      `Usage records: ${stats.usageRecordCount}`,
      `Empty usage records: ${stats.emptyUsageRecordCount}`,
      `Prompt-bearing records: ${stats.promptTokenRecordCount}`,
      `Oldest observed at: ${stats.oldestObservedAt ?? "n/a"}`,
      `Latest observed at: ${stats.latestObservedAt ?? "n/a"}`,
      `Prompt tokens: ${stats.totalPromptTokens}`,
      `Completion tokens: ${stats.totalCompletionTokens}`,
      `Total tokens: ${stats.totalTokens}`,
      `Cached tokens: ${stats.totalCachedTokens}`,
      `Cache hit records: ${stats.cacheHitRecords}/${stats.promptTokenRecordCount} (${this.toPercent(stats.cacheHitRate)})`,
      `Cache token rate: ${this.toPercent(stats.tokenCacheRate)}`,
    ];
    if (stats.sources.length > 0) {
      lines.push(`Sources: ${stats.sources.map((item) => `${item.value}=${item.count}`).join(", ")}`);
    }
    if (stats.models.length > 0) {
      lines.push(`Models: ${stats.models.map((item) => `${item.value}=${item.count}`).join(", ")}`);
    }
    return lines.join("\n");
  };

  private readonly toPercent = (value: number): string => {
    return `${(value * 100).toFixed(1)}%`;
  };
}
