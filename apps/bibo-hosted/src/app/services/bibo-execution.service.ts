import type { getSandbox, Sandbox } from "@cloudflare/sandbox";
import type { NcpTool } from "@nextclaw/ncp";
import type { WorkspaceByteStore } from "@nextclaw/kernel";

const MAX_COMMAND_CHARS = 8_000;
const MAX_OUTPUT_CHARS = 10_000;
const COMMAND_TIMEOUT_MS = 60_000;

type SandboxHandle = Pick<Sandbox, "exec" | "mountBucket" | "destroy" | "setKeepAlive" |
  "startProcess" | "listProcesses" | "killProcess" | "getProcessLogs">;
type Environment = { name: string; sandboxId: string; retainUntil?: number;
  mount?: { directory: string; prefix: string; path: string } };
type EnvironmentStorage = Pick<DurableObjectStorage, "get" | "put" | "delete" | "list" | "setAlarm">;
const ENVIRONMENT_PREFIX = "executionEnvironment:";

function environmentName(value: unknown): string {
  if (value === undefined) return "default";
  if (typeof value !== "string" || !/^[a-z][a-z0-9-]{0,39}$/.test(value)) {
    throw new Error("environment must contain 1-40 lowercase letters, digits or hyphens, starting with a letter");
  }
  return value;
}

function args(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    try { raw = JSON.parse(raw); } catch { throw new Error("Invalid tool arguments"); }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid tool arguments");
  return raw as Record<string, unknown>;
}

/** OS state is temporary; mounted user directories are already persisted directly in R2. */
export class BiboExecutionService {
  private readonly sandboxes = new Map<string, SandboxHandle>();

  constructor(
    private readonly namespace: DurableObjectNamespace<Sandbox>,
    private readonly accountId: string,
    private readonly signal: AbortSignal,
    private readonly workspace: WorkspaceByteStore & { mountPrefix(path: string): Promise<string> },
    private readonly storage: EnvironmentStorage,
    private readonly acquire?: typeof getSandbox,
  ) {}

  private getEnvironment = async (name: string): Promise<Environment> => {
    const key = `${ENVIRONMENT_PREFIX}${name}`;
    const existing = await this.storage.get<Environment>(key);
    if (existing) return existing;
    const environment = { name, sandboxId: `${this.accountId.slice(0, 24)}-${crypto.randomUUID()}` };
    await this.storage.put(key, environment);
    return environment;
  };

  private getSandbox = async (environment: Environment): Promise<SandboxHandle> => {
    const cached = this.sandboxes.get(environment.sandboxId);
    if (cached) return cached;
    const acquire = this.acquire ?? (await import("@cloudflare/sandbox")).getSandbox;
    const sandbox = acquire(this.namespace, environment.sandboxId, { sleepAfter: "5m" });
    this.sandboxes.set(environment.sandboxId, sandbox);
    return sandbox;
  };

  private mountDirectoryTool = (): NcpTool => ({
    name: "mount_directory",
    description: "Mount an existing persistent user directory into Linux. Its files are the same files used by read_file and write_file, with no copy or save step. Git repositories, node_modules and installed software should stay in temporary /workspace. Use '.' for the whole user workspace.",
    modelParameters: { type: "object", properties: { path: { type: "string",
      description: "Existing persistent directory path; '.' means the workspace root" },
      environment: { type: "string", description: "Named environment; defaults to default" } }, required: ["path"] },
    supportsParallelToolCalls: false,
    validateArgs: (value) => typeof value.path === "string" && value.path.trim() ? [] : ["path is required"],
    execute: async (raw, context) => {
      const value = args(raw);
      const path = value.path;
      if (typeof path !== "string" || !path.trim()) throw new Error("path is required");
      if (this.signal.aborted) throw new Error("Execution was cancelled");
      const resolved = this.workspace.resolve(path === "." ? "/data/workspace" : path);
      const environment = await this.getEnvironment(environmentName(value.environment));
      if (environment.mount && environment.mount.directory !== resolved) throw new Error(
        "This environment already mounts another directory. Use its common parent in a new environment, or choose another environment.");
      const prefix = await this.workspace.mountPrefix(resolved);
      const mountPath = "/mnt/bibo-data/1";
      environment.mount = { directory: resolved, prefix, path: mountPath };
      await this.storage.put(`${ENVIRONMENT_PREFIX}${environment.name}`, environment);
      context?.reportExecutionStarted?.();
      await this.ensureMount(environment);
      return JSON.stringify({ path: mountPath, persistent: true,
        selectedDirectory: resolved, temporaryWorkspace: "/workspace" });
    },
  });

  private execTool = (): NcpTool => ({
    name: "exec",
    description: "Run a shell command in an isolated Linux environment, reused across chat turns. Its OS, /workspace, Git and installed software are temporary and lost after idle reclamation (normally 5 minutes). Only a directory explicitly mounted with mount_directory persists. Use execution_environment to manage environments and background processes.",
    modelParameters: { type: "object", properties: { command: { type: "string", description: "Shell command to run" },
      environment: { type: "string", description: "Named environment; defaults to default" } },
      required: ["command"] },
    supportsParallelToolCalls: false,
    validateArgs: (value) => typeof value.command === "string" && value.command.trim() &&
      value.command.length <= MAX_COMMAND_CHARS ? [] : ["command must contain 1-8000 characters"],
    execute: async (raw, context) => {
      const value = args(raw);
      const command = value.command;
      if (typeof command !== "string" || !command.trim() || command.length > MAX_COMMAND_CHARS) {
        throw new Error("command must contain 1-8000 characters");
      }
      if (this.signal.aborted) throw new Error("Execution was cancelled");
      const environment = await this.getEnvironment(environmentName(value.environment));
      context?.reportExecutionStarted?.();
      await this.ensureMount(environment);
      const result = await (await this.getSandbox(environment)).exec(command, {
        cwd: "/workspace", timeout: COMMAND_TIMEOUT_MS, signal: this.signal,
      });
      return JSON.stringify({
        exitCode: result.exitCode,
        stdout: result.stdout.slice(0, MAX_OUTPUT_CHARS),
        stderr: result.stderr.slice(0, MAX_OUTPUT_CHARS),
        stdoutTruncated: result.stdout.length > MAX_OUTPUT_CHARS,
        stderrTruncated: result.stderr.length > MAX_OUTPUT_CHARS,
        workspaceIsTemporary: true,
        environment: environment.name,
        mountedDirectories: environment.mount ? [environment.mount.path] : [],
      });
    },
  });

  private ensureMount = async (environment: Environment): Promise<void> => {
    const mount = environment.mount;
    if (!mount) return;
    try {
      await (await this.getSandbox(environment)).mountBucket("SNAPSHOTS", mount.path, { prefix: mount.prefix });
    } catch (error) {
      // The SDK remembers mounts while its DO remains alive. Reissue after a DO
      // restart; accept only this exact, already-authorized mount collision.
      const expected = `Mount path "${mount.path}" is already in use by bucket "SNAPSHOTS". Unmount the existing bucket first or use a different mount path.`;
      if (!(error instanceof Error) || error.message !== expected) throw error;
    }
  };

  private environmentTool = (): NcpTool => ({
    name: "execution_environment",
    description: "Manage named temporary Linux environments. list reads saved handles without starting Linux; handles do not prove the OS is still alive. release destroys the OS. start_process starts a background process with an explicit retention lease (1-1440 minutes, billed while retained); retain renews an existing environment lease without starting another process. processes/logs/stop_process inspect or stop processes. Only mounted files persist after reclamation. Ports are not publicly exposed.",
    modelParameters: { type: "object", properties: {
      action: { type: "string", enum: ["list", "release", "start_process", "retain", "processes", "logs", "stop_process"] },
      environment: { type: "string" }, command: { type: "string" }, processId: { type: "string" },
      retainMinutes: { type: "integer", minimum: 1, maximum: 1440 },
    }, required: ["action"] },
    supportsParallelToolCalls: false,
    execute: async (raw, context) => {
      const value = args(raw);
      if (this.signal.aborted) throw new Error("Execution was cancelled");
      if (value.action === "list") return JSON.stringify([...
        (await this.storage.list<Environment>({ prefix: ENVIRONMENT_PREFIX })).values()
      ].map(({ name, retainUntil, mount }) => ({ name, retainUntil, mountedDirectory: mount?.directory, liveState: "not-checked" })));
      const name = environmentName(value.environment);
      if (value.action === "release") {
        const existing = await this.storage.get<Environment>(`${ENVIRONMENT_PREFIX}${name}`);
        if (existing) await this.release(existing);
        return JSON.stringify({ released: name });
      }
      if (!["start_process", "retain", "processes", "logs", "stop_process"].includes(String(value.action))) throw new Error("Unknown environment action");
      if (value.action === "start_process" && (typeof value.command !== "string" || !value.command.trim() ||
        value.command.length > MAX_COMMAND_CHARS || !Number.isInteger(value.retainMinutes) ||
        Number(value.retainMinutes) < 1 || Number(value.retainMinutes) > 1440)) throw new Error("A command and retainMinutes (1-1440) are required");
      if (value.action === "retain" && (!Number.isInteger(value.retainMinutes) ||
        Number(value.retainMinutes) < 1 || Number(value.retainMinutes) > 1440)) throw new Error("retainMinutes (1-1440) is required");
      if (["logs", "stop_process"].includes(String(value.action)) &&
        (typeof value.processId !== "string" || !value.processId)) throw new Error("processId is required");
      const environment = value.action === "start_process" ? await this.getEnvironment(name)
        : await this.storage.get<Environment>(`${ENVIRONMENT_PREFIX}${name}`);
      if (!environment) throw new Error("Environment not found; it may have been reclaimed");
      context?.reportExecutionStarted?.();
      const sandbox = await this.getSandbox(environment);
      if (value.action === "start_process" || value.action === "retain") {
        environment.retainUntil = Math.max(environment.retainUntil ?? 0, Date.now() + Number(value.retainMinutes) * 60_000);
        await this.storage.put(`${ENVIRONMENT_PREFIX}${name}`, environment);
        await this.scheduleReclamation();
        await sandbox.setKeepAlive(true);
        if (value.action === "retain") return JSON.stringify({ environment: name, retainUntil: environment.retainUntil,
          temporaryStateGuaranteed: false });
        await this.ensureMount(environment);
        const process = await sandbox.startProcess(value.command as string, { cwd: "/workspace" });
        return JSON.stringify({ environment: name, processId: process.id, status: process.status, retainUntil: environment.retainUntil });
      }
      if (value.action === "processes") return JSON.stringify((await sandbox.listProcesses()).map(
        (process) => ({ processId: process.id, status: process.status, exitCode: process.exitCode })));
      if (value.action === "stop_process") {
        await sandbox.killProcess(value.processId as string);
        return JSON.stringify({ stopped: value.processId, retentionEndsAt: environment.retainUntil });
      }
      const logs = await sandbox.getProcessLogs(value.processId as string);
      return JSON.stringify({ stdout: logs.stdout.slice(-MAX_OUTPUT_CHARS), stderr: logs.stderr.slice(-MAX_OUTPUT_CHARS),
        truncated: logs.stdout.length > MAX_OUTPUT_CHARS || logs.stderr.length > MAX_OUTPUT_CHARS });
    },
  });

  private release = async (environment: Environment): Promise<void> => {
    const sandbox = await this.getSandbox(environment);
    await sandbox.setKeepAlive(false);
    await sandbox.destroy();
    await this.storage.delete(`${ENVIRONMENT_PREFIX}${environment.name}`);
    this.sandboxes.delete(environment.sandboxId);
  };

  private scheduleReclamation = async (): Promise<void> => {
    const deadlines = [...(await this.storage.list<Environment>({ prefix: ENVIRONMENT_PREFIX })).values()]
      .flatMap((environment) => environment.retainUntil === undefined ? [] : [environment.retainUntil]);
    if (deadlines.length) await this.storage.setAlarm(Math.max(Date.now() + 1000, Math.min(...deadlines)));
  };

  reclaimExpired = async (): Promise<void> => {
    const environments = await this.storage.list<Environment>({ prefix: ENVIRONMENT_PREFIX });
    try {
      for (const environment of environments.values()) {
        if (environment.retainUntil !== undefined && environment.retainUntil <= Date.now()) await this.release(environment);
      }
    } catch (error) {
      await this.storage.setAlarm(Date.now() + 60_000);
      throw error;
    }
    await this.scheduleReclamation();
  };

  releaseAll = async (): Promise<void> => {
    for (const environment of (await this.storage.list<Environment>({ prefix: ENVIRONMENT_PREFIX })).values()) {
      await this.release(environment);
    }
  };

  tools = (): readonly NcpTool[] => [this.mountDirectoryTool(), this.execTool(), this.environmentTool()];

  dispose = async (): Promise<void> => {
    this.sandboxes.clear();
  };
}
