import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { getLogsArchivePath, getLogsPath } from "../core-utils/utils/helpers.utils.js";
import type { AppLogRecord } from "./app-logger.js";

export type AppLogKind = "service" | "crash";

export type AppLogPaths = {
  logsDir: string;
  archiveDir: string;
  serviceLogPath: string;
  crashLogPath: string;
};

export type AppLogQuery = {
  since?: Date;
  until?: Date;
  levels?: AppLogRecord["level"][];
  scope?: string;
  event?: string;
  outcome?: string;
  reasonCode?: string;
  correlationId?: string;
  limit?: number;
};

export type AppLogQueryResult = {
  records: AppLogRecord[];
  scannedFiles: string[];
  invalidLines: number;
  matchedRecords: number;
  truncated: boolean;
};

type FileLogSinkOptions = {
  serviceLogPath?: string;
  crashLogPath?: string;
  archiveDirPath?: string;
  serviceMaxBytes?: number;
  crashMaxBytes?: number;
  now?: () => Date;
};

type NormalizedAppLogQuery = {
  levels: Set<AppLogRecord["level"]> | null;
  query: AppLogQuery;
  sinceMs?: number;
  untilMs?: number;
};

const DEFAULT_SERVICE_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_CRASH_MAX_BYTES = 5 * 1024 * 1024;

function parseAppLogRecord(line: string): AppLogRecord | null {
  try {
    const record = JSON.parse(line) as AppLogRecord;
    const timestamp = Date.parse(record.ts);
    if (
      !Number.isFinite(timestamp)
      || typeof record.scope !== "string"
      || typeof record.message !== "string"
      || typeof record.level !== "string"
    ) {
      return null;
    }
    return record;
  } catch {
    return null;
  }
}

function matchesAppLogQuery(
  record: AppLogRecord,
  normalized: NormalizedAppLogQuery,
): boolean {
  const { levels, query, sinceMs, untilMs } = normalized;
  const timestamp = Date.parse(record.ts);
  const context = record.context ?? {};
  if (sinceMs !== undefined && timestamp < sinceMs) return false;
  if (untilMs !== undefined && timestamp > untilMs) return false;
  if (levels && !levels.has(record.level)) return false;
  if (query.scope && record.scope !== query.scope) return false;
  if (query.event && context.event !== query.event && record.message !== query.event) return false;
  if (query.outcome && context.outcome !== query.outcome) return false;
  if (query.reasonCode && context.reasonCode !== query.reasonCode) return false;
  if (
    query.correlationId
    && context.correlationId !== query.correlationId
    && context.parentCorrelationId !== query.correlationId
  ) return false;
  return true;
}

export class FileLogSink {
  private readonly serviceLogPath: string;
  private readonly crashLogPath: string;
  private readonly archiveDirPath: string;
  private readonly serviceMaxBytes: number;
  private readonly crashMaxBytes: number;
  private readonly now: () => Date;

  constructor(options: FileLogSinkOptions = {}) {
    this.serviceLogPath = options.serviceLogPath ?? resolve(getLogsPath(), "service.log");
    this.crashLogPath = options.crashLogPath ?? resolve(getLogsPath(), "crash.log");
    this.archiveDirPath = options.archiveDirPath ?? getLogsArchivePath();
    this.serviceMaxBytes = options.serviceMaxBytes ?? DEFAULT_SERVICE_MAX_BYTES;
    this.crashMaxBytes = options.crashMaxBytes ?? DEFAULT_CRASH_MAX_BYTES;
    this.now = options.now ?? (() => new Date());
  }

  getPaths = (): AppLogPaths => {
    return {
      logsDir: dirname(this.serviceLogPath),
      archiveDir: this.archiveDirPath,
      serviceLogPath: this.serviceLogPath,
      crashLogPath: this.crashLogPath,
    };
  };

  ensureReady = (): void => {
    const paths = this.getPaths();
    mkdirSync(paths.logsDir, { recursive: true });
    mkdirSync(paths.archiveDir, { recursive: true });
    this.rotateIfNeeded("service");
    this.rotateIfNeeded("crash");
    this.ensureFile(this.serviceLogPath);
    this.ensureFile(this.crashLogPath);
  };

  writeRecord = (record: AppLogRecord): void => {
    this.ensureReady();
    const line = this.serializeRecord(record);
    this.appendLine(this.serviceLogPath, line);
    if (record.level === "error" || record.level === "fatal") {
      this.appendLine(this.crashLogPath, line);
    }
  };

  tail = (kind: AppLogKind, lineCount: number): string[] => {
    const targetPath = this.resolveLogPath(kind);
    if (!existsSync(targetPath)) {
      return [];
    }
    const raw = readFileSync(targetPath, "utf-8");
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0);
    const normalizedCount = Number.isFinite(lineCount) ? Math.max(1, Math.trunc(lineCount)) : 50;
    return lines.slice(-normalizedCount);
  };

  query = (query: AppLogQuery = {}): AppLogQueryResult => {
    const paths = this.getPaths();
    const archiveFiles = existsSync(paths.archiveDir)
      ? readdirSync(paths.archiveDir)
        .filter((name) => /^service-.*\.log$/.test(name))
        .sort()
        .map((name) => resolve(paths.archiveDir, name))
      : [];
    const scannedFiles = [...archiveFiles, paths.serviceLogPath].filter(existsSync);
    const normalized: NormalizedAppLogQuery = {
      levels: query.levels?.length ? new Set(query.levels) : null,
      query,
      sinceMs: query.since?.getTime(),
      untilMs: query.until?.getTime(),
    };
    const matched: AppLogRecord[] = [];
    let invalidLines = 0;
    for (const path of scannedFiles) {
      for (const line of readFileSync(path, "utf-8").split(/\r?\n/)) {
        if (!line.trim()) {
          continue;
        }
        const record = parseAppLogRecord(line);
        if (!record) {
          invalidLines += 1;
          continue;
        }
        if (!matchesAppLogQuery(record, normalized)) {
          continue;
        }
        matched.push(record);
      }
    }
    matched.sort((left, right) => Date.parse(left.ts) - Date.parse(right.ts));
    const limit = Number.isFinite(query.limit)
      ? Math.min(5000, Math.max(1, Math.trunc(query.limit ?? 200)))
      : 200;
    return {
      records: matched.slice(-limit),
      scannedFiles,
      invalidLines,
      matchedRecords: matched.length,
      truncated: matched.length > limit,
    };
  };

  resolveLogPath = (kind: AppLogKind): string => (kind === "crash" ? this.crashLogPath : this.serviceLogPath);

  private ensureFile = (path: string): void => {
    if (!existsSync(path)) {
      writeFileSync(path, "", "utf-8");
    }
  };

  private appendLine = (path: string, line: string): void => {
    appendFileSync(path, `${line}\n`, "utf-8");
  };

  private rotateIfNeeded = (kind: AppLogKind): void => {
    const targetPath = this.resolveLogPath(kind);
    if (!existsSync(targetPath)) {
      return;
    }
    const maxBytes = kind === "crash" ? this.crashMaxBytes : this.serviceMaxBytes;
    if (statSync(targetPath).size < maxBytes) {
      return;
    }
    const timestamp = this.formatArchiveTimestamp(this.now());
    const archiveName = `${basename(targetPath, ".log")}-${timestamp}.log`;
    renameSync(targetPath, resolve(this.archiveDirPath, archiveName));
  };

  private serializeRecord = (record: AppLogRecord): string => {
    const seenObjects = new WeakSet<object>();
    try {
      return JSON.stringify(record, (_key, value) => {
        if (typeof value === "bigint") {
          return value.toString();
        }
        if (value instanceof Error) {
          return {
            name: value.name,
            message: value.message,
            ...(value.stack?.trim() ? { stack: value.stack.trim() } : {}),
          };
        }
        if (typeof value === "object" && value !== null) {
          if (seenObjects.has(value)) {
            return "[Circular]";
          }
          seenObjects.add(value);
        }
        return value;
      });
    } catch (error) {
      return JSON.stringify({
        ts: record.ts,
        level: "error",
        scope: "logging.file_log_sink",
        message: "failed to serialize log record",
        startupId: record.startupId,
        pid: record.pid,
        context: {
          originalScope: record.scope,
          originalMessage: record.message,
          serializationError: error instanceof Error ? error.message : String(error),
        },
      });
    }
  };

  private formatArchiveTimestamp = (value: Date): string => {
    return value.toISOString().replace(/:/g, "-").replace(/\.\d{3}Z$/, "Z");
  };
}
