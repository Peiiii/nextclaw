import { spawn, type ChildProcess } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type ExtensionServerConfig = {
  type: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

export type ExtensionManifest = {
  id: string;
  name?: string;
  version?: string;
  rootDir: string;
  server: ExtensionServerConfig;
  contributes?: {
    channels?: Array<{
      id: string;
      name?: string;
      description?: string;
      meta?: Record<string, unknown>;
      configSchema?: Record<string, unknown>;
      configUiHints?: Record<string, Record<string, unknown>>;
      auth?: boolean | Record<string, unknown>;
    }>;
  };
};

export type RunningExtensionProcess = {
  manifest: ExtensionManifest;
  process: ChildProcess;
};

export type ExtensionLifecycleServiceOptions = {
  endpoint: string;
  token: string;
  spawnProcess?: typeof spawn;
  logger?: Pick<Console, "warn">;
};

const EXTENSION_MANIFEST_FILE = "nextclaw.extension.json";

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.every((item) => typeof item === "string") ? value : undefined;
}

function readStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const entries = Object.entries(value);
  if (!entries.every(([, item]) => typeof item === "string")) {
    return undefined;
  }
  return Object.fromEntries(entries) as Record<string, string>;
}

function sanitizeExtensionNodeOptions(value: string | undefined): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }
  const tokens = value.split(/\s+/).filter(Boolean);
  const sanitized: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "--conditions=development" || token === "-C=development") {
      continue;
    }
    if ((token === "--conditions" || token === "-C") && tokens[index + 1] === "development") {
      index += 1;
      continue;
    }
    sanitized.push(token);
  }
  return sanitized.length > 0 ? sanitized.join(" ") : undefined;
}

function toManifest(value: unknown, rootDir: string): ExtensionManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("extension manifest must be an object");
  }
  const record = value as Record<string, unknown>;
  const server = record.server;
  if (!server || typeof server !== "object" || Array.isArray(server)) {
    throw new Error("extension manifest server is required");
  }
  const serverRecord = server as Record<string, unknown>;
  const id = readString(record.id);
  const command = readString(serverRecord.command);
  if (!id) {
    throw new Error("extension manifest id is required");
  }
  if (serverRecord.type !== "stdio") {
    throw new Error("extension server.type must be stdio");
  }
  if (!command) {
    throw new Error("extension server.command is required");
  }
  return {
    id,
    rootDir,
    ...(readString(record.name) ? { name: readString(record.name) } : {}),
    ...(readString(record.version) ? { version: readString(record.version) } : {}),
    server: {
      type: "stdio",
      command,
      ...(readStringArray(serverRecord.args) ? { args: readStringArray(serverRecord.args) } : {}),
      ...(readStringRecord(serverRecord.env) ? { env: readStringRecord(serverRecord.env) } : {}),
    },
    ...(record.contributes && typeof record.contributes === "object" && !Array.isArray(record.contributes)
      ? { contributes: record.contributes as ExtensionManifest["contributes"] }
      : {}),
  };
}

export class ExtensionManifestDiscoveryService {
  readonly discover = async (roots: string[]): Promise<ExtensionManifest[]> => {
    const manifests: ExtensionManifest[] = [];
    for (const root of roots) {
      manifests.push(...(await this.discoverRoot(root)));
    }
    return manifests;
  };

  private readonly discoverRoot = async (root: string): Promise<ExtensionManifest[]> => {
    const directManifest = await this.readManifestIfExists(join(root, EXTENSION_MANIFEST_FILE));
    if (directManifest) {
      return [directManifest];
    }

    const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
    const manifests = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => this.readManifestIfExists(join(root, entry.name, EXTENSION_MANIFEST_FILE))),
    );
    return manifests.filter((manifest): manifest is ExtensionManifest => Boolean(manifest));
  };

  private readonly readManifestIfExists = async (path: string): Promise<ExtensionManifest | null> => {
    try {
      return toManifest(JSON.parse(await readFile(path, "utf-8")), dirname(path));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  };
}

export class ExtensionLifecycleService {
  private readonly processes = new Map<string, RunningExtensionProcess>();
  private readonly spawnProcess: typeof spawn;
  private readonly logger: Pick<Console, "warn">;

  constructor(private readonly options: ExtensionLifecycleServiceOptions) {
    this.spawnProcess = options.spawnProcess ?? spawn;
    this.logger = options.logger ?? console;
  }

  readonly startAll = async (manifests: ExtensionManifest[]): Promise<RunningExtensionProcess[]> => {
    const started: RunningExtensionProcess[] = [];
    for (const manifest of manifests) {
      started.push(this.start(manifest));
    }
    return started;
  };

  readonly start = (manifest: ExtensionManifest): RunningExtensionProcess => {
    const existing = this.processes.get(manifest.id);
    if (existing) {
      return existing;
    }
    const child = this.spawnProcess(manifest.server.command, manifest.server.args ?? [], {
      cwd: manifest.rootDir,
      env: {
        ...process.env,
        NODE_OPTIONS: sanitizeExtensionNodeOptions(process.env.NODE_OPTIONS),
        ...manifest.server.env,
        NEXTCLAW_EXTENSION_ID: manifest.id,
        NEXTCLAW_EXTENSION_ENDPOINT: this.options.endpoint,
        NEXTCLAW_EXTENSION_TOKEN: this.options.token,
      },
      stdio: ["ignore", "ignore", "inherit"],
    });
    const running = { manifest, process: child };
    this.processes.set(manifest.id, running);
    child.once("exit", () => {
      if (this.processes.get(manifest.id)?.process === child) {
        this.processes.delete(manifest.id);
      }
      this.logger.warn(`Extension ${manifest.id} exited.`);
    });
    child.once("error", (error) => {
      this.logger.warn(`Extension ${manifest.id} failed: ${error.message}`);
    });
    return running;
  };

  readonly stopAll = async (): Promise<void> => {
    const running = Array.from(this.processes.values());
    this.processes.clear();
    await Promise.all(running.map((entry) => this.stopProcess(entry.process)));
  };

  readonly list = (): RunningExtensionProcess[] => Array.from(this.processes.values());

  private readonly stopProcess = async (child: ChildProcess): Promise<void> => {
    if (child.exitCode !== null || child.signalCode !== null) {
      return;
    }
    await new Promise<void>((resolve) => {
      child.once("exit", () => resolve());
      child.kill();
      setTimeout(resolve, 1000).unref();
    });
  };
}
