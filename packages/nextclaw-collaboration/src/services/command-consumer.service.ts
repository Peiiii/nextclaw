import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  Consumer,
  Execution,
  ExecutionResult,
} from "../types/collaboration.types.js";

export class CommandConsumer implements Consumer {
  private children = new Map<string, ChildProcess>();
  constructor(
    private readonly command: string[],
    private readonly workspace: string,
    private readonly directory: string,
  ) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
  }
  create = async (): Promise<string> => {
    return randomUUID();
  };
  submit = async (
    threadId: string,
    requestId: string,
    prompt: string,
  ): Promise<Execution> => {
    const execution = { threadId, requestId, turnId: requestId };
    const child = spawn(this.command[0], this.command.slice(1), {
      cwd: this.workspace,
      stdio: ["pipe", "pipe", "pipe"],
      env: consumerEnvironment(),
    });
    this.children.set(requestId, child);
    let output = "";
    child.stderr.resume();
    child.stdout.on("data", (chunk) => {
      output += chunk;
      if (output.length > 100000) child.kill();
    });
    child.once("error", (error) =>
      this.save(requestId, { state: "failed", error: error.message }),
    );
    child.once("close", (code, signal) => {
      this.children.delete(requestId);
      if (signal) this.save(requestId, { state: "cancelled" });
      else if (code !== 0 || output.length > 100000)
        this.save(requestId, {
          state: "failed",
          error: `Command exited ${code} or output exceeded limit`,
        });
      else {
        try {
          const result = JSON.parse(output) as {
            text?: string;
            quiet?: boolean;
          };
          this.save(requestId, {
            state: "completed",
            text: result.quiet ? "COLLABORATION_QUIET" : result.text,
          });
        } catch {
          this.save(requestId, {
            state: "failed",
            error: "Command must return JSON {text} or {quiet:true}",
          });
        }
      }
    });
    child.stdin.on("error", () => {});
    child.stdin.end(JSON.stringify({ ...execution, prompt }));
    this.save(requestId, { state: "running" });
    return execution;
  };
  recover = async (
    threadId: string,
    requestId: string,
  ): Promise<Execution | undefined> => {
    return this.read(requestId)
      ? { threadId, requestId, turnId: requestId }
      : undefined;
  };
  inspect = async (execution: Execution): Promise<ExecutionResult> => {
    const state = this.read(execution.requestId);
    if (state?.state === "running" && !this.children.has(execution.requestId))
      return {
        state: "unknown",
        error: "Command owner restarted; inspect side effects before retry",
      };
    return state || { state: "unknown" };
  };
  cancel = async (execution: Execution): Promise<void> => {
    const child = this.children.get(execution.requestId);
    if (!child) throw new Error("Command process not owned by this host");
    child.kill("SIGTERM");
  };
  close = async (): Promise<void> => {
    for (const child of this.children.values()) child.kill();
  };
  private read = (id: string): ExecutionResult | undefined => {
    try {
      return JSON.parse(
        readFileSync(join(this.directory, `${id}.json`), "utf8"),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  };
  private save = (id: string, value: ExecutionResult): void => {
    const path = join(this.directory, `${id}.json`);
    writeFileSync(`${path}.tmp`, JSON.stringify(value), { mode: 0o600 });
    renameSync(`${path}.tmp`, path);
  };
}
export function consumerEnvironment(): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !/^(GH_TOKEN|GITHUB_TOKEN|GH_ENTERPRISE_TOKEN|GITHUB_ENTERPRISE_TOKEN|LINEAR_API_KEY|LINEAR_ACCESS_TOKEN|DISCUSSION_PARTICIPANT_TOKEN)$/.test(
          key,
        ),
    ),
  );
}
