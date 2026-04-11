export type AppLogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export type AppLogFields = Record<string, unknown>;

export type AppLogError = {
  name: string;
  message: string;
  stack?: string;
};

export type AppLogRecord = {
  ts: string;
  level: AppLogLevel;
  scope: string;
  event: string;
  startupId: string;
  pid: number;
  fields?: AppLogFields;
  error?: AppLogError;
};

export type AppLogWriter = {
  writeRecord: (record: AppLogRecord) => void;
};

export type AppLogger = {
  debug: (event: string, fields?: AppLogFields) => void;
  info: (event: string, fields?: AppLogFields) => void;
  warn: (event: string, fields?: AppLogFields) => void;
  error: (event: string, fields?: AppLogFields, error?: unknown) => void;
  fatal: (event: string, fields?: AppLogFields, error?: unknown) => void;
  child: (scope: string, fields?: AppLogFields) => AppLogger;
};

type ScopedAppLoggerOptions = {
  writer: AppLogWriter;
  scope: string;
  startupId: string;
  pid: number;
  now?: () => Date;
  baseFields?: AppLogFields;
};

function joinScope(parentScope: string, childScope: string): string {
  const trimmedChild = childScope.trim();
  if (!trimmedChild) {
    return parentScope;
  }
  return parentScope ? `${parentScope}.${trimmedChild}` : trimmedChild;
}

function mergeFields(baseFields?: AppLogFields, fields?: AppLogFields): AppLogFields | undefined {
  if (!baseFields && !fields) {
    return undefined;
  }
  return {
    ...(baseFields ?? {}),
    ...(fields ?? {}),
  };
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
  private readonly baseFields?: AppLogFields;

  constructor(options: ScopedAppLoggerOptions) {
    const { baseFields, now, pid, scope, startupId, writer } = options;
    this.writer = writer;
    this.scope = scope;
    this.startupId = startupId;
    this.pid = pid;
    this.now = now ?? (() => new Date());
    this.baseFields = baseFields;
  }

  debug = (event: string, fields?: AppLogFields): void => {
    this.write("debug", event, fields);
  };

  info = (event: string, fields?: AppLogFields): void => {
    this.write("info", event, fields);
  };

  warn = (event: string, fields?: AppLogFields): void => {
    this.write("warn", event, fields);
  };

  error = (event: string, fields?: AppLogFields, error?: unknown): void => {
    this.write("error", event, fields, error);
  };

  fatal = (event: string, fields?: AppLogFields, error?: unknown): void => {
    this.write("fatal", event, fields, error);
  };

  child = (scope: string, fields?: AppLogFields): AppLogger => {
    return new ScopedAppLogger({
      writer: this.writer,
      scope: joinScope(this.scope, scope),
      startupId: this.startupId,
      pid: this.pid,
      now: this.now,
      baseFields: mergeFields(this.baseFields, fields),
    });
  };

  private write = (
    level: AppLogLevel,
    event: string,
    fields?: AppLogFields,
    error?: unknown
  ): void => {
    this.writer.writeRecord({
      ts: this.now().toISOString(),
      level,
      scope: this.scope,
      event,
      startupId: this.startupId,
      pid: this.pid,
      ...(mergeFields(this.baseFields, fields) ? { fields: mergeFields(this.baseFields, fields) } : {}),
      ...(normalizeLogError(error) ? { error: normalizeLogError(error) } : {}),
    });
  };
}
