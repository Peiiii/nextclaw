import {
  NextclawHarnessError,
  type NextclawTaskInput,
  type NextclawTaskResult,
} from "@nextclaw/kernel";
import type { Readable, Writable } from "node:stream";
import { format } from "node:util";

export type ExecCommandOptions = {
  agent?: string;
  session?: string;
  model?: string;
  format?: "text" | "json" | "jsonl";
  timeout?: string | number;
};

type ExecFormat = NonNullable<ExecCommandOptions["format"]>;
type ExecCancellationReason = "interrupted" | "timed_out";

type ExecCancellationScope = {
  signal: AbortSignal;
  getReason: () => ExecCancellationReason | undefined;
  dispose: () => void;
};

export type ExecCommandRuntime = {
  runTask: (input: NextclawTaskInput) => Promise<NextclawTaskResult>;
};

export type ExecCommandIo = {
  stdin?: Readable & { isTTY?: boolean };
  stdout?: Writable;
  stderr?: Writable;
};

const EXEC_SCHEMA_VERSION = "nextclaw.exec/v1" as const;

function write(stream: Writable, value: string): void {
  stream.write(value);
}

function redirectConsoleToStderr(stderr: Writable): () => void {
  const methods = ["debug", "error", "info", "log", "warn"] as const;
  const originals = new Map<
    (typeof methods)[number],
    (...args: unknown[]) => void
  >();
  for (const method of methods) {
    const original = console[method] as (...args: unknown[]) => void;
    originals.set(method, original);
    console[method] = (...args: unknown[]) =>
      write(stderr, `${format(...args)}\n`);
  }
  return () => {
    for (const method of methods) {
      const original = originals.get(method);
      if (original) {
        console[method] = original;
      }
    }
  };
}

async function readPipedStdin(
  stdin: Readable & { isTTY?: boolean },
): Promise<string> {
  if (stdin.isTTY === true) {
    return "";
  }
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function resolveFormat(value: ExecCommandOptions["format"]): ExecFormat {
  const resolved = value ?? "text";
  if (resolved !== "text" && resolved !== "json" && resolved !== "jsonl") {
    throw new NextclawHarnessError(
      "invalid_input",
      "--format must be text, json, or jsonl.",
    );
  }
  return resolved;
}

async function resolveInput(
  stdin: Readable & { isTTY?: boolean },
  promptParts: readonly string[],
): Promise<string> {
  const stdinText = (await readPipedStdin(stdin)).trim();
  const prompt = promptParts.join(" ").trim();
  const input = [prompt, stdinText]
    .filter(Boolean)
    .join(prompt && stdinText ? "\n" : "");
  if (!input) {
    throw new NextclawHarnessError(
      "invalid_input",
      "A prompt argument or piped stdin is required.",
    );
  }
  return input;
}

function resolveTimeout(
  value: string | number | undefined,
): number | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }
  const timeout = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(timeout) || timeout <= 0) {
    throw new NextclawHarnessError(
      "invalid_input",
      "--timeout must be a positive integer in milliseconds.",
    );
  }
  return timeout;
}

function classifyExitCode(code: NextclawHarnessError["code"]): number {
  if (code === "invalid_input") {
    return 2;
  }
  if (code === "cancelled") {
    return 130;
  }
  return 1;
}

function toPublicError(error: unknown): NextclawHarnessError {
  if (error instanceof NextclawHarnessError) {
    return error;
  }
  return new NextclawHarnessError(
    "runtime_failure",
    error instanceof Error ? error.message : String(error ?? "Unknown error"),
    error,
  );
}

function createCancellationScope(
  timeout: number | undefined,
): ExecCancellationScope {
  const controller = new AbortController();
  let reason: ExecCancellationReason | undefined;
  const abort = (nextReason: ExecCancellationReason): void => {
    if (reason) {
      return;
    }
    reason = nextReason;
    controller.abort();
  };
  const onSigint = (): void => abort("interrupted");
  const timeoutHandle =
    timeout === undefined
      ? undefined
      : setTimeout(() => abort("timed_out"), timeout);
  process.once("SIGINT", onSigint);
  return {
    signal: controller.signal,
    getReason: () => reason,
    dispose: () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      process.removeListener("SIGINT", onSigint);
    },
  };
}

function resolvePublicError(
  error: unknown,
  cancellationReason: ExecCancellationReason | undefined,
): NextclawHarnessError {
  const caughtError = toPublicError(error);
  if (!cancellationReason) {
    return caughtError;
  }
  return new NextclawHarnessError(
    "cancelled",
    cancellationReason === "timed_out"
      ? "Task timed out."
      : "Task interrupted.",
    caughtError,
  );
}

function writeMachineError(
  format: "json" | "jsonl",
  error: NextclawHarnessError,
  stdout: Writable,
): void {
  const payload = {
    schemaVersion: EXEC_SCHEMA_VERSION,
    status: "error" as const,
    error: { code: error.code, message: error.message },
  };
  write(
    stdout,
    format === "json"
      ? `${JSON.stringify(payload)}\n`
      : `${JSON.stringify({ ...payload, type: "error" })}\n`,
  );
}

function createEventHandler(
  outputFormat: ExecFormat,
  stdout: Writable,
): NextclawTaskInput["onEvent"] {
  if (outputFormat !== "jsonl") {
    return undefined;
  }
  return (event) =>
    write(
      stdout,
      `${JSON.stringify({ schemaVersion: EXEC_SCHEMA_VERSION, type: "event", event })}\n`,
    );
}

async function runTaskWithDiagnostics(params: {
  runtime: ExecCommandRuntime;
  input: string;
  options: ExecCommandOptions;
  outputFormat: ExecFormat;
  signal: AbortSignal;
  stdout: Writable;
  stderr: Writable;
}): Promise<NextclawTaskResult> {
  const { input, options, outputFormat, runtime, signal, stderr, stdout } =
    params;
  const restoreConsole = redirectConsoleToStderr(stderr);
  try {
    return await runtime.runTask({
      agentId: options.agent,
      input,
      model: options.model,
      onEvent: createEventHandler(outputFormat, stdout),
      sessionId: options.session,
      signal,
    });
  } finally {
    restoreConsole();
  }
}

function writeResult(
  outputFormat: ExecFormat,
  result: NextclawTaskResult,
  stdout: Writable,
): void {
  if (outputFormat === "text") {
    write(stdout, `${result.text}\n`);
    return;
  }
  const payload =
    outputFormat === "json"
      ? {
          schemaVersion: EXEC_SCHEMA_VERSION,
          status: "completed" as const,
          result,
        }
      : {
          schemaVersion: EXEC_SCHEMA_VERSION,
          type: "result" as const,
          status: "completed" as const,
          result,
        };
  write(stdout, `${JSON.stringify(payload)}\n`);
}

function writeFailure(
  requestedFormat: string,
  error: NextclawHarnessError,
  stdout: Writable,
  stderr: Writable,
): number {
  if (requestedFormat === "json" || requestedFormat === "jsonl") {
    writeMachineError(requestedFormat, error, stdout);
  } else {
    write(stderr, `Error: ${error.message}\n`);
  }
  return classifyExitCode(error.code);
}

export async function executeExecCommand(
  runtime: ExecCommandRuntime,
  promptParts: readonly string[] = [],
  options: ExecCommandOptions = {},
  io: ExecCommandIo = {},
): Promise<number> {
  const stdin = io.stdin ?? process.stdin;
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  const requestedFormat = options.format ?? "text";
  let cancellationScope: ExecCancellationScope | undefined;

  try {
    const outputFormat = resolveFormat(options.format);
    cancellationScope = createCancellationScope(
      resolveTimeout(options.timeout),
    );
    const input = await resolveInput(stdin, promptParts);
    const result = await runTaskWithDiagnostics({
      runtime,
      input,
      options,
      outputFormat,
      signal: cancellationScope.signal,
      stdout,
      stderr,
    });
    writeResult(outputFormat, result, stdout);
    return 0;
  } catch (error) {
    const publicError = resolvePublicError(
      error,
      cancellationScope?.getReason(),
    );
    return writeFailure(requestedFormat, publicError, stdout, stderr);
  } finally {
    cancellationScope?.dispose();
  }
}
