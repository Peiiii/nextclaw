import { getLoggingRuntime, type AppLogKind, type AppLogLevel, type LoggingRuntime } from "@nextclaw/core";
import type { LogsQueryCommandOptions, LogsTailCommandOptions } from "@nextclaw-service/types/cli.types.js";

const LOG_LEVELS = new Set<AppLogLevel>(["debug", "info", "warn", "error", "fatal"]);

function parseTime(value: string | undefined, name: "since" | "until", now = Date.now()): Date | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }
  const duration = normalized.match(/^(\d+)([mhd])$/i);
  if (duration && name === "since") {
    const amount = Number(duration[1]);
    const unitMs = duration[2].toLowerCase() === "m"
      ? 60_000
      : duration[2].toLowerCase() === "h"
        ? 3_600_000
        : 86_400_000;
    return new Date(now - amount * unitMs);
  }
  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(`${name} must be an ISO timestamp${name === "since" ? " or duration such as 30m, 2h, 7d" : ""}`);
  }
  return parsed;
}

export class LogsCommands {
  constructor(private readonly runtime: LoggingRuntime = getLoggingRuntime()) {}

  path = (): void => {
    const paths = this.runtime.getPaths();
    console.log([
      `Logs directory: ${paths.logsDir}`,
      `Service log: ${paths.serviceLogPath}`,
      `Crash log: ${paths.crashLogPath}`,
      `Archive: ${paths.archiveDir}`,
    ].join("\n"));
  };

  tail = (opts: LogsTailCommandOptions = {}): void => {
    const kind: AppLogKind = opts.crash ? "crash" : "service";
    const rawLines = Number(opts.lines);
    const lines = Number.isFinite(rawLines) && rawLines > 0 ? Math.floor(rawLines) : 40;
    const output = this.runtime.tail(kind, lines);
    if (output.length === 0) {
      console.log(`No log entries found in ${this.runtime.resolveLogPath(kind)}.`);
      return;
    }
    console.log(output.join("\n"));
  };

  query = (opts: LogsQueryCommandOptions = {}): void => {
    if (opts.scope && opts.domain) {
      throw new Error("Use either --scope or --domain, not both");
    }
    const levels = opts.level?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];
    if (levels.some((level) => !LOG_LEVELS.has(level as AppLogLevel))) {
      throw new Error("--level must contain debug, info, warn, error, or fatal");
    }
    const rawLimit = Number(opts.limit ?? 200);
    if (!Number.isFinite(rawLimit) || rawLimit <= 0) {
      throw new Error("--limit must be a positive number");
    }
    const result = this.runtime.query({
      since: parseTime(opts.since, "since"),
      until: parseTime(opts.until, "until"),
      levels: levels as AppLogLevel[],
      scope: opts.domain ? `diagnostics.${opts.domain.trim()}` : opts.scope?.trim(),
      event: opts.event?.trim(),
      outcome: opts.outcome?.trim(),
      reasonCode: opts.reasonCode?.trim(),
      correlationId: opts.correlationId?.trim(),
      limit: rawLimit,
    });
    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    for (const record of result.records) {
      console.log(JSON.stringify(record));
    }
    console.log(JSON.stringify({
      matchedRecords: result.matchedRecords,
      returnedRecords: result.records.length,
      invalidLines: result.invalidLines,
      truncated: result.truncated,
      scannedFiles: result.scannedFiles,
    }));
  };
}
