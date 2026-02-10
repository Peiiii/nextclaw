import { exec } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { Tool } from "./base.js";

const execAsync = promisify(exec);

export class ExecTool extends Tool {
  private denyPatterns: RegExp[];
  private allowPatterns: RegExp[];

  constructor(
    private options: {
      timeout?: number;
      workingDir?: string | null;
      denyPatterns?: string[];
      allowPatterns?: string[];
      restrictToWorkspace?: boolean;
    } = {}
  ) {
    super();
    this.denyPatterns = (options.denyPatterns ?? [
      "\\brm\\s+-[rf]{1,2}\\b",
      "\\bdel\\s+/[fq]\\b",
      "\\brmdir\\s+/s\\b",
      "\\b(format|mkfs|diskpart)\\b",
      "\\bdd\\s+if=",
      ">\\s*/dev/sd",
      "\\b(shutdown|reboot|poweroff)\\b",
      ":\\(\\)\\s*\\{.*\\};\\s*:"
    ]).map((pattern) => new RegExp(pattern, "i"));
    this.allowPatterns = (options.allowPatterns ?? []).map((pattern) => new RegExp(pattern, "i"));
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
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout: (this.options.timeout ?? 60) * 1000,
        maxBuffer: 10_000_000
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
}

function truncateOutput(result: string, maxLen = 10000): string {
  if (result.length <= maxLen) {
    return result;
  }
  return `${result.slice(0, maxLen)}\n... (truncated, ${result.length - maxLen} more chars)`;
}
