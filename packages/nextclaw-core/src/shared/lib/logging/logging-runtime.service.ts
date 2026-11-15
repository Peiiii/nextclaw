import { FileLogSink, type AppLogKind, type AppLogPaths, type AppLogQuery, type AppLogQueryResult } from "./file-log-sink.service.js";
import { ScopedAppLogger, type AppLogRecord, type AppLogWriter, type AppLogger } from "./app-logger.service.js";
import { normalizeLogError } from "./log-error.utils.js";

const CONSOLE_METHOD_NAMES = ["debug", "info", "log", "warn", "error"] as const;
type ConsoleMethodName = typeof CONSOLE_METHOD_NAMES[number];

type ConfigureAppLoggingOptions = {
  installConsoleMirror?: boolean;
  installProcessCrashMonitor?: boolean;
};

type LoggingRuntimeOptions = {
  sink?: FileLogSink;
  startupId?: string;
  pid?: number;
  now?: () => Date;
};

type InstalledConsoleMirror = {
  runtimeKey: string;
  restore: () => void;
};

type InstalledCrashMonitor = {
  runtimeKey: string;
  listener: (error: Error, origin: NodeJS.UncaughtExceptionOrigin) => void;
  rejectionListener: (reason: unknown, promise: Promise<unknown>) => void;
};

let activeLoggingRuntime: LoggingRuntime | null = null;
let installedConsoleMirror: InstalledConsoleMirror | null = null;
let installedCrashMonitor: InstalledCrashMonitor | null = null;

export class LoggingRuntime implements AppLogWriter {
  private readonly sink: FileLogSink;
  private readonly startupId: string;
  private readonly pid: number;
  private readonly now: () => Date;
  private sinkFailureReported = false;
  private sourceFailureReported = false;

  constructor(options: LoggingRuntimeOptions = {}) {
    this.sink = options.sink ?? new FileLogSink();
    this.startupId = options.startupId ?? this.createStartupId();
    this.pid = options.pid ?? process.pid;
    this.now = options.now ?? (() => new Date());
  }

  ensureReady = (): void => {
    try { this.sink.ensureReady(); }
    catch (error) { this.reportSinkFailure(error); }
  };

  getStartupId = (): string => {
    return this.startupId;
  };

  getPaths = (): AppLogPaths => {
    return this.sink.getPaths();
  };

  tail = (kind: AppLogKind, lineCount: number): string[] => {
    return this.sink.tail(kind, lineCount);
  };

  query = (query: AppLogQuery): AppLogQueryResult => {
    return this.sink.query(query);
  };

  resolveLogPath = (kind: AppLogKind): string => {
    return this.sink.resolveLogPath(kind);
  };

  getLogger = (scope: string): AppLogger => {
    return new ScopedAppLogger({
      writer: this,
      scope,
      startupId: this.startupId,
      pid: this.pid,
      now: this.now,
    });
  };

  writeRecord = (record: AppLogRecord): void => {
    try {
      this.sink.writeRecord(record);
      this.sinkFailureReported = false;
      this.sourceFailureReported = false;
    } catch (error) {
      this.reportSinkFailure(error, record);
    }
  };

  private reportSinkFailure = (error: unknown, record?: AppLogRecord): void => {
    if (this.sinkFailureReported && (!record?.error || this.sourceFailureReported)) return;
    this.sinkFailureReported = true;
    this.sourceFailureReported ||= Boolean(record?.error);
    const correlationId = record?.context?.correlationId;
    const event = record?.context?.event;
    try {
      process.stderr.write(`${JSON.stringify({
        ts: this.now().toISOString(), level: "error", scope: "logging.file_log_sink",
        event: "logging.write_failed", startupId: this.startupId, pid: this.pid,
        error: normalizeLogError(error), sourceScope: record?.scope.slice(0, 256),
        ...(typeof event === "string" ? { sourceEvent: event.slice(0, 256) } : {}),
        ...(typeof correlationId === "string" ? { correlationId: correlationId.slice(0, 128) } : {}),
        ...(record?.error ? { sourceError: normalizeLogError(record.error) } : {}),
      })}\n`);
    } catch {
      // An unavailable diagnostic destination must not throw into the business operation.
    }
  };

  installConsoleMirror = (): void => {
    const runtimeKey = this.getPaths().serviceLogPath;
    if (installedConsoleMirror?.runtimeKey === runtimeKey) {
      return;
    }
    installedConsoleMirror?.restore();
    this.ensureReady();

    const originalConsole = Object.fromEntries(
      CONSOLE_METHOD_NAMES.map((name) => [name, console[name].bind(console)])
    ) as Record<ConsoleMethodName, typeof console.log>;

    const consoleLogger = this.getLogger("console");
    const methodLevels: Record<ConsoleMethodName, "debug" | "info" | "warn" | "error"> = {
      debug: "debug",
      info: "info",
      log: "info",
      warn: "warn",
      error: "error",
    };

    const restore = () => {
      for (const name of CONSOLE_METHOD_NAMES) {
        console[name] = originalConsole[name];
      }
      if (installedConsoleMirror?.runtimeKey === runtimeKey) {
        installedConsoleMirror = null;
      }
    };

    const installMethod = (name: ConsoleMethodName) => {
      console[name] = ((...args: unknown[]) => {
        originalConsole[name](...args);
        if (args.length === 0) {
          return;
        }
        consoleLogger[methodLevels[name]](...args);
      }) as typeof console.log;
    };

    for (const name of CONSOLE_METHOD_NAMES) {
      installMethod(name);
    }

    installedConsoleMirror = {
      runtimeKey,
      restore,
    };
  };

  installProcessCrashMonitor = (): void => {
    const runtimeKey = this.getPaths().crashLogPath;
    if (installedCrashMonitor?.runtimeKey === runtimeKey) {
      return;
    }
    if (installedCrashMonitor) {
      process.off("uncaughtExceptionMonitor", installedCrashMonitor.listener);
      process.off("unhandledRejection", installedCrashMonitor.rejectionListener);
    }
    const crashLogger = this.getLogger("runtime.crash");
    const listener = (error: Error, origin: NodeJS.UncaughtExceptionOrigin) => {
      crashLogger.fatal("uncaught exception", { origin }, error);
    };
    const rejectionListener = (reason: unknown, _promise: Promise<unknown>) => {
      if (reason instanceof Error) {
        crashLogger.error("unhandled rejection", { promiseState: "unhandled" }, reason);
        return;
      }
      crashLogger.error("unhandled rejection", {
        promiseState: "unhandled",
        reason: String(reason),
      });
    };
    process.on("uncaughtExceptionMonitor", listener);
    process.on("unhandledRejection", rejectionListener);
    installedCrashMonitor = {
      runtimeKey,
      listener,
      rejectionListener,
    };
  };

  private createStartupId = (): string => {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  };
}

export function getLoggingRuntime(): LoggingRuntime {
  if (!activeLoggingRuntime) {
    activeLoggingRuntime = new LoggingRuntime();
  }
  return activeLoggingRuntime;
}

export function configureAppLogging(options: ConfigureAppLoggingOptions = {}): LoggingRuntime {
  const runtime = getLoggingRuntime();
  runtime.ensureReady();
  if (options.installConsoleMirror) {
    runtime.installConsoleMirror();
  }
  if (options.installProcessCrashMonitor) {
    runtime.installProcessCrashMonitor();
  }
  return runtime;
}

export function getAppLogger(scope: string): AppLogger {
  return getLoggingRuntime().getLogger(scope);
}

export function getAppLogPaths(): AppLogPaths {
  return getLoggingRuntime().getPaths();
}

export function tailAppLog(kind: AppLogKind, lineCount: number): string[] {
  return getLoggingRuntime().tail(kind, lineCount);
}

export function resolveAppLogPath(kind: AppLogKind): string {
  return getLoggingRuntime().resolveLogPath(kind);
}
