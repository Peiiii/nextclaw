import { format } from "node:util";

export type AppLogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export type AppLogContext = Record<string, unknown>;

export type AppLogError = {
  name: string;
  message: string;
  stack?: string;
};

export type AppLogRecord = {
  ts: string;
  level: AppLogLevel;
  scope: string;
  message: string;
  startupId: string;
  pid: number;
  context?: AppLogContext;
  error?: AppLogError;
};

export type AppLogWriter = {
  writeRecord: (record: AppLogRecord) => void;
};

export type AppLogger = {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  fatal: (...args: unknown[]) => void;
  child: (scope: string) => AppLogger;
};

type ScopedAppLoggerOptions = {
  writer: AppLogWriter;
  scope: string;
  startupId: string;
  pid: number;
  now?: () => Date;
};

function joinScope(parentScope: string, childScope: string): string {
  const trimmedChild = childScope.trim();
  if (!trimmedChild) {
    return parentScope;
  }
  return parentScope ? `${parentScope}.${trimmedChild}` : trimmedChild;
}

function isPlainObject(value: unknown): value is AppLogContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function containsFormatDirective(value: string): boolean {
  return /%[sdifoOj%]/.test(value);
}

function normalizeLogError(error: unknown): AppLogError | undefined {
  if (!error) {
    return undefined;
  }
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(error.stack?.trim() ? { stack: error.stack.trim() } : {}),
    };
  }
  return {
    name: "NonError",
    message: String(error),
  };
}

export class ScopedAppLogger implements AppLogger {
  private readonly writer: AppLogWriter;
  private readonly scope: string;
  private readonly startupId: string;
  private readonly pid: number;
  private readonly now: () => Date;
  constructor(options: ScopedAppLoggerOptions) {
    const { now, pid, scope, startupId, writer } = options;
    this.writer = writer;
    this.scope = scope;
    this.startupId = startupId;
    this.pid = pid;
    this.now = now ?? (() => new Date());
  }

  debug = (...args: unknown[]): void => {
    this.write("debug", args);
  };

  info = (...args: unknown[]): void => {
    this.write("info", args);
  };

  warn = (...args: unknown[]): void => {
    this.write("warn", args);
  };

  error = (...args: unknown[]): void => {
    this.write("error", args);
  };

  fatal = (...args: unknown[]): void => {
    this.write("fatal", args);
  };

  child = (scope: string): AppLogger => {
    return new ScopedAppLogger({
      writer: this.writer,
      scope: joinScope(this.scope, scope),
      startupId: this.startupId,
      pid: this.pid,
      now: this.now,
    });
  };

  private write = (level: AppLogLevel, args: unknown[]): void => {
    const { message, context, error } = this.normalizeArgs(args);
    if (!message && !context && !error) {
      return;
    }
    this.writer.writeRecord({
      ts: this.now().toISOString(),
      level,
      scope: this.scope,
      message,
      startupId: this.startupId,
      pid: this.pid,
      ...(context ? { context } : {}),
      ...(error ? { error } : {}),
    });
  };

  private normalizeArgs = (args: unknown[]): {
    message: string;
    context?: AppLogContext;
    error?: AppLogError;
  } => {
    const errorCandidate = args.at(-1);
    const error = errorCandidate instanceof Error ? normalizeLogError(errorCandidate) : undefined;
    const argsWithoutError = error ? args.slice(0, -1) : args;
    const { context, messageArgs } = this.extractContext(argsWithoutError);
    const message = this.buildMessage(messageArgs, error);
    return {
      message,
      ...(context ? { context } : {}),
      ...(error ? { error } : {}),
    };
  };

  private extractContext = (args: unknown[]): {
    messageArgs: unknown[];
    context?: AppLogContext;
  } => {
    if (args.length < 2) {
      return { messageArgs: args };
    }
    const lastArg = args.at(-1);
    const firstArg = args[0];
    if (!isPlainObject(lastArg) || typeof firstArg !== "string" || containsFormatDirective(firstArg)) {
      return { messageArgs: args };
    }
    return {
      messageArgs: args.slice(0, -1),
      context: lastArg,
    };
  };

  private buildMessage = (args: unknown[], error?: AppLogError): string => {
    const formatted = args.length > 0 ? format(...args).trim() : "";
    if (formatted) {
      return formatted;
    }
    return error?.message ?? "";
  };
}
