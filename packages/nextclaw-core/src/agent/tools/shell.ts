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

  setContext(context: { sessionKey?: string; channel?: string; chatId?: string }): void {
    this.context = {
      sessionKey: typeof context.sessionKey === "string" ? context.sessionKey.trim() || undefined : undefined,
      channel: typeof context.channel === "string" ? context.channel.trim() || undefined : undefined,
      chatId: typeof context.chatId === "string" ? context.chatId.trim() || undefined : undefined
    };
  }

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

  async execute(params: Record<string, unknown>): Promise<string> {
    const command = String(params.command ?? "");
    const cwd = String(params.workingDir ?? this.options.workingDir ?? process.cwd());
    const guardError = this.guardCommand(command, cwd);
    if (guardError) {
      return guardError;
    }

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
      const outputParts: string[] = [];
      if (stdout) {
        outputParts.push(stdout);
      }
      if (stderr?.trim()) {
        outputParts.push(`STDERR:\n${stderr}`);
      }
      const result = outputParts.length ? outputParts.join("\n") : "(no output)";
      return truncateOutput(result);
    } catch (err) {
      return `Error executing command: ${String(err)}`;
    }
  }

  private guardCommand(command: string, cwd: string): string | null {
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
  }

  private isDangerousCommand(command: string): boolean {
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
  }
}

function truncateOutput(result: string, maxLen = 10000): string {
  if (result.length <= maxLen) {
    return result;
  }
  return `${result.slice(0, maxLen)}\n... (truncated, ${result.length - maxLen} more chars)`;
}
