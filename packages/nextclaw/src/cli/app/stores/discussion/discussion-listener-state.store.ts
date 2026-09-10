import { randomUUID } from "node:crypto";
import {
  chmod,
  mkdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";

export type DiscussionListenerConfig = {
  endpoint: string;
  tokenFile: string;
  intervalMs: number;
  timeoutMs: number;
  command: string[];
};
export type DiscussionEventState = {
  threadId: string;
  type: "thread-created" | "post-created" | "thread-updated";
  cursor: number;
  state: "launching" | "delivered" | "failed";
  attempts: number;
  updatedAt: string;
  nextAttemptAt?: string;
  lastError?: string;
};
export type DiscussionListenerJournal = {
  version: 1;
  cursor: number;
  events: Record<string, DiscussionEventState>;
};
export type DiscussionListenerRuntime = {
  instanceId: string;
  pid: number;
  startedAt: string;
  heartbeatAt: string;
  lastScanAt?: string;
  lastEventId?: string;
  lastError?: string;
};
export type CodexDiscussionBinding = {
  threadId: string;
  eventIds: Record<string, string>;
};
export type CodexDiscussionBindings = {
  version: 1;
  discussions: Record<string, CodexDiscussionBinding>;
};

const emptyJournal = (): DiscussionListenerJournal => ({
  version: 1,
  cursor: 0,
  events: {},
});
const emptyBindings = (): CodexDiscussionBindings => ({
  version: 1,
  discussions: {},
});

export class DiscussionListenerStateStore {
  readonly root: string;
  readonly configPath: string;
  readonly journalPath: string;
  readonly runtimePath: string;
  readonly logPath: string;
  readonly codexConsumerLogPath: string;
  readonly codexBindingsPath: string;

  constructor(
    root = resolve(
      process.env.NEXTCLAW_DISCUSSION_STATE_DIRECTORY?.trim() ||
        join(
          resolve(
            process.env.NEXTCLAW_HOME?.trim() || join(homedir(), ".nextclaw")
          ),
          "discussion-listener"
        )
    )
  ) {
    this.root = root;
    this.configPath = join(root, "config.json");
    this.journalPath = join(root, "journal.json");
    this.runtimePath = join(root, "runtime.json");
    this.logPath = join(root, "listener.log");
    this.codexConsumerLogPath = join(root, "codex-consumer.log");
    this.codexBindingsPath = join(root, "discussion-bindings.json");
  }

  initialize = async (): Promise<void> => {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    await chmod(this.root, 0o700);
  };

  writeConfig = async (
    input: Omit<DiscussionListenerConfig, "intervalMs" | "timeoutMs"> & {
      intervalMs?: number;
      timeoutMs?: number;
    }
  ): Promise<DiscussionListenerConfig> => {
    const config = await this.validateConfig({
      ...input,
      intervalMs: input.intervalMs ?? 30_000,
      timeoutMs: input.timeoutMs ?? 60_000,
    });
    await this.writeJson(this.configPath, config);
    return config;
  };

  readConfig = async (): Promise<DiscussionListenerConfig> => {
    const value = await this.readJson<DiscussionListenerConfig>(
      this.configPath
    );
    if (!value)
      throw new Error(
        "Discussion listener is not configured. Run `nextclaw discussion listen configure --help`."
      );
    return this.validateConfig({
      ...value,
      intervalMs: value.intervalMs ?? 30_000,
      timeoutMs: value.timeoutMs ?? 60_000,
    });
  };

  readJournal = async (): Promise<DiscussionListenerJournal> =>
    (await this.readJson(this.journalPath)) ?? emptyJournal();
  writeJournal = async (value: DiscussionListenerJournal): Promise<void> =>
    this.writeJson(this.journalPath, value);
  readRuntime = async (): Promise<DiscussionListenerRuntime | null> =>
    this.readJson(this.runtimePath);
  writeRuntime = async (value: DiscussionListenerRuntime): Promise<void> =>
    this.writeJson(this.runtimePath, value);
  clearRuntime = async (): Promise<void> => {
    try {
      await unlink(this.runtimePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  };
  readCodexBindings = async (): Promise<CodexDiscussionBindings> =>
    (await this.readJson(this.codexBindingsPath)) ?? emptyBindings();
  writeCodexBindings = async (value: CodexDiscussionBindings): Promise<void> =>
    this.writeJson(this.codexBindingsPath, value);

  private validateConfig = async (
    value: DiscussionListenerConfig
  ): Promise<DiscussionListenerConfig> => {
    const endpoint = new URL(value.endpoint);
    if (
      (endpoint.protocol !== "https:" &&
        !(
          endpoint.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(endpoint.hostname)
        )) ||
      endpoint.username ||
      endpoint.password ||
      endpoint.pathname !== "/" ||
      endpoint.search ||
      endpoint.hash
    ) {
      throw new Error("Invalid discussion origin.");
    }
    if (!isAbsolute(value.tokenFile) || !(await stat(value.tokenFile)).isFile())
      throw new Error(
        "Participant token file must be an existing absolute file."
      );
    const tokenMode = (await stat(value.tokenFile)).mode & 0o777;
    if (process.platform !== "win32" && tokenMode & 0o077)
      throw new Error(
        "Participant token file permissions must be 0600 or stricter."
      );
    if (
      !Number.isInteger(value.intervalMs) ||
      value.intervalMs < 1_000 ||
      value.intervalMs > 3_600_000
    )
      throw new Error(
        "Polling interval must be between 1000 and 3600000 milliseconds."
      );
    if (
      !Number.isInteger(value.timeoutMs) ||
      value.timeoutMs < 10_000 ||
      value.timeoutMs > 86_400_000
    )
      throw new Error(
        "Trigger timeout must be between 10000 and 86400000 milliseconds."
      );
    if (
      !Array.isArray(value.command) ||
      value.command.some((item) => typeof item !== "string" || !item) ||
      !value.command.length
    ) {
      throw new Error("Configure a trigger command after `--`.");
    }
    return {
      endpoint: endpoint.origin,
      tokenFile: resolve(value.tokenFile),
      intervalMs: value.intervalMs,
      timeoutMs: value.timeoutMs,
      command: [...value.command],
    };
  };

  private readJson = async <T>(path: string): Promise<T | null> => {
    try {
      return JSON.parse(await readFile(path, "utf8")) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  };

  private writeJson = async (path: string, value: unknown): Promise<void> => {
    await this.initialize();
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    const temporary = path + "." + randomUUID() + ".tmp";
    await writeFile(temporary, JSON.stringify(value, null, 2) + "\n", {
      mode: 0o600,
    });
    await chmod(temporary, 0o600);
    await rename(temporary, path);
  };
}
