import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { getLogsArchivePath, getLogsPath } from "../utils/helpers.js";
import type { AppLogLevel, AppLogRecord } from "./app-logger.js";

export type AppLogKind = "service" | "crash";

export type AppLogPaths = {
  logsDir: string;
  archiveDir: string;
  serviceLogPath: string;
  crashLogPath: string;
};

type FileLogSinkOptions = {
  serviceLogPath?: string;
  crashLogPath?: string;
  archiveDirPath?: string;
  serviceMaxBytes?: number;
  crashMaxBytes?: number;
  now?: () => Date;
};

const DEFAULT_SERVICE_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_CRASH_MAX_BYTES = 5 * 1024 * 1024;

function shouldMirrorToCrash(level: AppLogLevel): boolean {
  return level === "error" || level === "fatal";
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
    if (shouldMirrorToCrash(record.level)) {
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

  resolveLogPath = (kind: AppLogKind): string => {
    return kind === "crash" ? this.crashLogPath : this.serviceLogPath;
  };

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
