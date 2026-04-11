import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { format } from "node:util";
import { getLogsArchivePath, getLogsPath } from "@nextclaw/core";

export type RuntimeLogKind = "service" | "crash";

type RuntimeLogManagerOptions = {
  serviceLogPath?: string;
  crashLogPath?: string;
  archiveDirPath?: string;
  serviceMaxBytes?: number;
  crashMaxBytes?: number;
  startupId?: string;
  now?: () => Date;
  pid?: number;
};

type ConsoleMethodName = "debug" | "info" | "log" | "warn" | "error";

type InstalledConsoleMirror = {
  managerKey: string;
  restore: () => void;
};

type InstalledCrashMonitor = {
  managerKey: string;
  listener: (error: Error, origin: NodeJS.UncaughtExceptionOrigin) => void;
};

const DEFAULT_SERVICE_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_CRASH_MAX_BYTES = 5 * 1024 * 1024;

let installedConsoleMirror: InstalledConsoleMirror | null = null;
let installedCrashMonitor: InstalledCrashMonitor | null = null;

export class RuntimeLogManager {
  private readonly serviceLogPath: string;
  private readonly crashLogPath: string;
  private readonly archiveDirPath: string;
  private readonly serviceMaxBytes: number;
  private readonly crashMaxBytes: number;
  private readonly startupId: string;
  private readonly now: () => Date;
  private readonly pid: number;

  constructor(options: RuntimeLogManagerOptions = {}) {
    this.serviceLogPath = options.serviceLogPath ?? resolve(getLogsPath(), "service.log");
    this.crashLogPath = options.crashLogPath ?? resolve(getLogsPath(), "crash.log");
    this.archiveDirPath = options.archiveDirPath ?? getLogsArchivePath();
    this.serviceMaxBytes = options.serviceMaxBytes ?? DEFAULT_SERVICE_MAX_BYTES;
    this.crashMaxBytes = options.crashMaxBytes ?? DEFAULT_CRASH_MAX_BYTES;
    this.startupId = options.startupId ?? this.createStartupId();
    this.now = options.now ?? (() => new Date());
    this.pid = options.pid ?? process.pid;
  }

  getPaths = (): {
    logsDir: string;
    archiveDir: string;
    serviceLogPath: string;
    crashLogPath: string;
  } => {
    return {
      logsDir: dirname(this.serviceLogPath),
      archiveDir: this.archiveDirPath,
      serviceLogPath: this.serviceLogPath,
      crashLogPath: this.crashLogPath,
    };
  };

  getStartupId = (): string => {
    return this.startupId;
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

  appendServiceLine = (message: string): void => {
    this.appendLines("service", "info", message);
  };

  appendCrashLine = (message: string, level: "error" | "fatal" = "error"): void => {
    this.appendLines("crash", level, message);
  };

  captureCrash = (label: string, error: unknown): void => {
    const rendered = this.formatError(error);
    this.appendCrashLine(`${label}: ${rendered}`, "fatal");
    this.appendLines("service", "fatal", `${label}: ${rendered}`);
  };

  tail = (kind: RuntimeLogKind, lineCount: number): string[] => {
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

  installConsoleMirror = (): void => {
    if (installedConsoleMirror?.managerKey === this.serviceLogPath) {
      return;
    }
    installedConsoleMirror?.restore();
    this.ensureReady();

    const originalConsole: Record<ConsoleMethodName, typeof console.log> = {
      debug: console.debug.bind(console),
      info: console.info.bind(console),
      log: console.log.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
    };

    const methodLevels: Record<ConsoleMethodName, "debug" | "info" | "warn" | "error"> = {
      debug: "debug",
      info: "info",
      log: "info",
      warn: "warn",
      error: "error",
    };

    const restore = () => {
      console.debug = originalConsole.debug;
      console.info = originalConsole.info;
      console.log = originalConsole.log;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
      if (installedConsoleMirror?.managerKey === this.serviceLogPath) {
        installedConsoleMirror = null;
      }
    };

    const installMethod = (name: ConsoleMethodName) => {
      console[name] = ((...args: unknown[]) => {
        originalConsole[name](...args);
        const rendered = format(...args);
        if (!rendered.trim()) {
          return;
        }
        const level = methodLevels[name];
        this.appendLines("service", level, rendered);
        if (level === "error") {
          this.appendLines("crash", "error", rendered);
        }
      }) as typeof console.log;
    };

    installMethod("debug");
    installMethod("info");
    installMethod("log");
    installMethod("warn");
    installMethod("error");

    installedConsoleMirror = {
      managerKey: this.serviceLogPath,
      restore,
    };
  };

  installProcessCrashMonitor = (): void => {
    if (installedCrashMonitor?.managerKey === this.crashLogPath) {
      return;
    }
    if (installedCrashMonitor) {
      process.off("uncaughtExceptionMonitor", installedCrashMonitor.listener);
    }
    process.on("uncaughtExceptionMonitor", this.handleUncaughtException);
    installedCrashMonitor = {
      managerKey: this.crashLogPath,
      listener: this.handleUncaughtException,
    };
  };

  resolveLogPath = (kind: RuntimeLogKind): string => {
    return kind === "crash" ? this.crashLogPath : this.serviceLogPath;
  };

  private handleUncaughtException = (error: Error, origin: NodeJS.UncaughtExceptionOrigin): void => {
    this.captureCrash(`uncaughtException (${origin})`, error);
  };

  private appendLines = (
    kind: RuntimeLogKind,
    level: "debug" | "info" | "warn" | "error" | "fatal",
    message: string
  ): void => {
    this.ensureReady();
    const targetPath = this.resolveLogPath(kind);
    const lines = message
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0);
    if (lines.length === 0) {
      return;
    }
    const content = lines.map((line) => this.formatLine(level, line)).join("\n") + "\n";
    appendFileSync(targetPath, content, "utf-8");
  };

  private ensureFile = (path: string): void => {
    if (!existsSync(path)) {
      writeFileSync(path, "", "utf-8");
    }
  };

  private rotateIfNeeded = (kind: RuntimeLogKind): void => {
    const targetPath = this.resolveLogPath(kind);
    if (!existsSync(targetPath)) {
      return;
    }
    const maxBytes = kind === "crash" ? this.crashMaxBytes : this.serviceMaxBytes;
    const size = statSync(targetPath).size;
    if (size < maxBytes) {
      return;
    }
    const timestamp = this.formatArchiveTimestamp(this.now());
    const archiveName = `${basename(targetPath, ".log")}-${timestamp}.log`;
    renameSync(targetPath, resolve(this.archiveDirPath, archiveName));
  };

  private formatLine = (level: "debug" | "info" | "warn" | "error" | "fatal", message: string): string => {
    return `[${this.now().toISOString()}] [${level}] [pid=${this.pid}] [startup=${this.startupId}] ${message}`;
  };

  private formatArchiveTimestamp = (value: Date): string => {
    return value.toISOString().replace(/:/g, "-").replace(/\.\d{3}Z$/, "Z");
  };

  private formatError = (error: unknown): string => {
    if (error instanceof Error) {
      return error.stack?.trim() ? error.stack.trim() : `${error.name}: ${error.message}`;
    }
    return format(error);
  };

  private createStartupId = (): string => {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  };
}
