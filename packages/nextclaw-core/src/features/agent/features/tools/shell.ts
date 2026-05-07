import { exec } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { Tool } from "./base.js";
import { createExternalCommandEnv } from "../../utils/child-process-env.js";

const execAsync = promisify(exec);
type ExecRunnerOptions = {
  cwd: string;
  timeout: number;
  maxBuffer: number;
  env: NodeJS.ProcessEnv;
  windowsHide?: boolean;
};
type ExecRunnerResult = {
  stdout: string;
  stderr: string;
};
type ExecRunner = (command: string, options: ExecRunnerOptions) => Promise<ExecRunnerResult>;

const MAX_EXEC_STREAM_CHARS = 10_000;

export type ExecToolResult = {
  ok: boolean;
  command: string;
  workingDir: string;
  exitCode: number | null;
  errorCode: string | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  killed: boolean;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  message?: string;
  blocked?: boolean;
  blockedReason?: string;
};

type ExecErrorLike = Error & {
  code?: number | string;
  signal?: NodeJS.Signals | null;
  stdout?: string;
  stderr?: string;
  killed?: boolean;
};

export class ExecTool extends Tool {
  private denyPatterns: RegExp[];
  private allowPatterns: RegExp[];
  private dangerousCommands: string[];
  private context: { sessionKey?: string; channel?: string; chatId?: string } = {};

  constructor(
    private options: {
      timeout?: number;
      workingDir?: string | null;
      denyPatterns?: string[];
      allowPatterns?: string[];
      restrictToWorkspace?: boolean;
    } = {},
    private readonly runner: ExecRunner = execAsync as ExecRunner
  ) {
    super();
    this.denyPatterns = (options.denyPatterns ?? [
      "\\brm\\s+-[rf]{1,2}\\b",
      "\\bdel\\s+/[fq]\\b",
      "\\brmdir\\s+/s\\b",
      "\\bdd\\s+if=",
      ">\\s*/dev/sd",
      "\\b(shutdown|reboot|poweroff)\\b",
      ":\\(\\)\\s*\\{.*\\};\\s*:"
    ]).map((pattern) => new RegExp(pattern, "i"));
    this.allowPatterns = (options.allowPatterns ?? []).map((pattern) => new RegExp(pattern, "i"));
    this.dangerousCommands = ["format", "diskpart", "mkfs"];
  }

  setContext = (context: { sessionKey?: string; channel?: string; chatId?: string }): void => {
    this.context = {
      sessionKey: typeof context.sessionKey === "string" ? context.sessionKey.trim() || undefined : undefined,
      channel: typeof context.channel === "string" ? context.channel.trim() || undefined : undefined,
      chatId: typeof context.chatId === "string" ? context.chatId.trim() || undefined : undefined
    };
  };

  get name(): string {
    return "exec";
  }

  get description(): string {
    return "Execute a shell command and return its output. Use with caution.";
  }

  get parameters(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        command: { type: "string", description: "The shell command to execute" },
        workingDir: { type: "string", description: "Optional working directory for the command" }
      },
      required: ["command"]
    };
  }

  execute = async (params: Record<string, unknown>): Promise<ExecToolResult> => {
    const command = String(params.command ?? "");
    const cwd = String(params.workingDir ?? this.options.workingDir ?? process.cwd());
    const guardError = this.guardCommand(command, cwd);
    if (guardError) {
      return createBlockedExecResult({
        command,
        workingDir: cwd,
        message: guardError,
        blockedReason: normalizeBlockedReason(guardError)
      });
    }

    const startedAt = Date.now();
    try {
      const env = createExternalCommandEnv(process.env, {}, { cwd });
      if (this.context.sessionKey) {
        env.NEXTCLAW_RUNTIME_SESSION_KEY = this.context.sessionKey;
      }
      if (this.context.channel) {
        env.NEXTCLAW_RUNTIME_CHANNEL = this.context.channel;
      }
      if (this.context.chatId) {
        env.NEXTCLAW_RUNTIME_CHAT_ID = this.context.chatId;
      }
      const { stdout, stderr } = await this.runner(command, {
        cwd,
        timeout: (this.options.timeout ?? 60) * 1000,
        maxBuffer: 10_000_000,
        env,
        windowsHide: process.platform === "win32",
      });
      return createExecResult({
        ok: true,
        command,
        workingDir: cwd,
        exitCode: 0,
        errorCode: null,
        signal: null,
        stdout,
        stderr,
        durationMs: Date.now() - startedAt,
        timedOut: false,
        killed: false
      });
    } catch (err) {
      const normalized = normalizeExecError(err);
      return createExecResult({
        ok: false,
        command,
        workingDir: cwd,
        exitCode: normalized.exitCode,
        errorCode: normalized.errorCode,
        signal: normalized.signal,
        stdout: normalized.stdout,
        stderr: normalized.stderr,
        durationMs: Date.now() - startedAt,
        timedOut: normalized.timedOut,
        killed: normalized.killed,
        message: normalized.message
      });
    }
  };

  private guardCommand = (command: string, cwd: string): string | null => {
    const normalized = command.trim().toLowerCase();
    if (this.isDangerousCommand(normalized)) {
      return "Error: Command blocked by safety guard (dangerous pattern detected)";
    }
    for (const pattern of this.denyPatterns) {
      if (pattern.test(normalized)) {
        return "Error: Command blocked by safety guard (dangerous pattern detected)";
      }
    }
    if (this.allowPatterns.length && !this.allowPatterns.some((pattern) => pattern.test(normalized))) {
      return "Error: Command blocked by safety guard (not in allowlist)";
    }
    if (this.options.restrictToWorkspace) {
      if (command.includes("../") || command.includes("..\\")) {
        return "Error: Command blocked by safety guard (path traversal detected)";
      }
      const cwdPath = resolve(cwd);
      const matches = [...command.matchAll(/(?:^|[\s|>])([^\s"'>]+)/g)].map((match) => match[1]);
      for (const raw of matches) {
        if (raw.startsWith("/") || /^[A-Za-z]:\\/.test(raw)) {
          const resolved = resolve(raw);
          if (!resolved.startsWith(cwdPath)) {
            return "Error: Command blocked by safety guard (path outside working dir)";
          }
        }
      }
    }
    return null;
  };

  private isDangerousCommand = (command: string): boolean => {
    const segments = command.split(/\s*(?:\|\||&&|;|\|)\s*/);
    for (const segment of segments) {
      const match = segment.trim().match(/^(?:sudo\s+)?([^\s]+)/i);
      if (!match) {
        continue;
      }
      const token = match[1]?.toLowerCase() ?? "";
      if (!token) {
        continue;
      }
      if (this.dangerousCommands.includes(token)) {
        return true;
      }
      if (token.startsWith("mkfs")) {
        return true;
      }
    }
    return false;
  };
}

function createBlockedExecResult(params: {
  command: string;
  workingDir: string;
  message: string;
  blockedReason: string;
}): ExecToolResult {
  return {
    ok: false,
    command: params.command,
    workingDir: params.workingDir,
    exitCode: null,
    errorCode: null,
    signal: null,
    stdout: "",
    stderr: "",
    durationMs: 0,
    timedOut: false,
    killed: false,
    stdoutTruncated: false,
    stderrTruncated: false,
    message: params.message,
    blocked: true,
    blockedReason: params.blockedReason
  };
}

function createExecResult(params: {
  ok: boolean;
  command: string;
  workingDir: string;
  exitCode: number | null;
  errorCode: string | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  killed: boolean;
  message?: string;
}): ExecToolResult {
  const stdout = truncateExecStream(params.stdout);
  const stderr = truncateExecStream(params.stderr);
  return {
    ok: params.ok,
    command: params.command,
    workingDir: params.workingDir,
    exitCode: params.exitCode,
    errorCode: params.errorCode,
    signal: params.signal,
    stdout: stdout.text,
    stderr: stderr.text,
    durationMs: params.durationMs,
    timedOut: params.timedOut,
    killed: params.killed,
    stdoutTruncated: stdout.truncated,
    stderrTruncated: stderr.truncated,
    ...(params.message ? { message: params.message } : {})
  };
}

function normalizeExecError(error: unknown): {
  message: string;
  exitCode: number | null;
  errorCode: string | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  killed: boolean;
} {
  const typed = error instanceof Error ? (error as ExecErrorLike) : undefined;
  const rawCode = typed?.code;
  const exitCode = typeof rawCode === "number" ? rawCode : null;
  const errorCode = typeof rawCode === "string" ? rawCode : null;
  const message = typed?.message || String(error ?? "Unknown exec error");
  const signal = typeof typed?.signal === "string" ? typed.signal : null;
  const stdout = toExecText(typed?.stdout);
  const stderr = toExecText(typed?.stderr);
  const killed = typed?.killed === true;
  const timedOut = errorCode === "ETIMEDOUT" || /timed out/i.test(message);

  return {
    message,
    exitCode,
    errorCode,
    signal,
    stdout,
    stderr,
    timedOut,
    killed
  };
}

function normalizeBlockedReason(message: string): string {
  if (message.includes("dangerous pattern detected")) {
    return "dangerous_pattern";
  }
  if (message.includes("not in allowlist")) {
    return "not_in_allowlist";
  }
  if (message.includes("path traversal detected")) {
    return "path_traversal";
  }
  if (message.includes("path outside working dir")) {
    return "outside_working_dir";
  }
  return "blocked";
}

function toExecText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function truncateExecStream(text: string, maxLen = MAX_EXEC_STREAM_CHARS): { text: string; truncated: boolean } {
  if (text.length <= maxLen) {
    return { text, truncated: false };
  }
  return {
    text: `${text.slice(0, maxLen)}\n... (truncated, ${text.length - maxLen} more chars)`,
    truncated: true
  };
}
