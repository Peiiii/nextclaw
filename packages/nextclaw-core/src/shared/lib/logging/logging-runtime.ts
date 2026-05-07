import { FileLogSink, type AppLogKind, type AppLogPaths } from "./file-log-sink.js";
import { ScopedAppLogger, type AppLogRecord, type AppLogWriter, type AppLogger } from "./app-logger.js";

type ConsoleMethodName = "debug" | "info" | "log" | "warn" | "error";

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

  constructor(options: LoggingRuntimeOptions = {}) {
    this.sink = options.sink ?? new FileLogSink();
    this.startupId = options.startupId ?? this.createStartupId();
    this.pid = options.pid ?? process.pid;
    this.now = options.now ?? (() => new Date());
  }

  ensureReady = (): void => {
    this.sink.ensureReady();
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
    this.sink.writeRecord(record);
  };

  installConsoleMirror = (): void => {
    const runtimeKey = this.getPaths().serviceLogPath;
    if (installedConsoleMirror?.runtimeKey === runtimeKey) {
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

    const consoleLogger = this.getLogger("console");
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
        switch (methodLevels[name]) {
          case "debug":
            consoleLogger.debug(...args);
            return;
          case "warn":
            consoleLogger.warn(...args);
            return;
          case "error":
            consoleLogger.error(...args);
            return;
          default:
            consoleLogger.info(...args);
        }
      }) as typeof console.log;
    };

    installMethod("debug");
    installMethod("info");
    installMethod("log");
    installMethod("warn");
    installMethod("error");

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
