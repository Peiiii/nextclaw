import { createHash, randomUUID } from "node:crypto";
import {
  chmod,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import type {
  SessionKey,
  SessionStore,
  SessionStoreEntry,
} from "@anthropic-ai/claude-agent-sdk";

const SESSION_STORE_DIR_NAME = "claude-code-session-store";
const NEXTCLAW_DEFAULT_HOME_DIR = ".nextclaw";

export type ClaudeCodeSessionStoreOptions = {
  rootDir: string;
  resumeSessionId?: string | null;
  legacyConfigDirs?: readonly string[];
};

export class ClaudeCodeSessionStore implements SessionStore {
  private readonly rootDir: string;
  private readonly resumeSessionId: string | null;
  private readonly legacyConfigDirs: readonly string[];
  private readonly writes = new Map<string, Promise<void>>();

  constructor(options: ClaudeCodeSessionStoreOptions) {
    this.rootDir = resolve(options.rootDir);
    this.resumeSessionId = options.resumeSessionId?.trim() || null;
    this.legacyConfigDirs = [...new Set(
      (options.legacyConfigDirs ?? []).map((configDir) => resolve(configDir)),
    )];
  }

  append = async (key: SessionKey, entries: SessionStoreEntry[]): Promise<void> => {
    if (entries.length === 0) {
      return;
    }

    const filePath = this.resolveFilePath(key);
    const previousWrite = this.writes.get(filePath) ?? Promise.resolve();
    const nextWrite = previousWrite
      .catch(() => undefined)
      .then(async () => this.appendEntries(filePath, entries));
    this.writes.set(filePath, nextWrite);

    try {
      await nextWrite;
    } finally {
      if (this.writes.get(filePath) === nextWrite) {
        this.writes.delete(filePath);
      }
    }
  };

  load = async (key: SessionKey): Promise<SessionStoreEntry[] | null> => {
    const filePath = this.resolveFilePath(key);
    await this.writes.get(filePath);
    const storedEntries = await this.readStoredEntries(filePath);
    if (storedEntries) {
      return storedEntries;
    }
    if (key.subpath || key.sessionId !== this.resumeSessionId) {
      return null;
    }

    const legacyEntries = await this.loadLegacyTranscript(key.sessionId);
    if (!legacyEntries) {
      return null;
    }
    await this.append(key, legacyEntries);
    return await this.readStoredEntries(filePath);
  };

  private appendEntries = async (
    filePath: string,
    entries: SessionStoreEntry[],
  ): Promise<void> => {
    const currentEntries = await this.readStoredEntries(filePath) ?? [];
    const knownUuids = new Set(
      currentEntries.flatMap((entry) => entry.uuid ? [entry.uuid] : []),
    );
    const nextEntries = [...currentEntries];

    for (const entry of entries) {
      if (entry.uuid && knownUuids.has(entry.uuid)) {
        continue;
      }
      nextEntries.push(entry);
      if (entry.uuid) {
        knownUuids.add(entry.uuid);
      }
    }

    await this.writeEntries(filePath, nextEntries);
  };

  private readStoredEntries = async (filePath: string): Promise<SessionStoreEntry[] | null> => {
    let content: string;
    try {
      content = await readFile(filePath, "utf8");
    } catch (error) {
      if (isMissingFileError(error)) {
        return null;
      }
      throw error;
    }

    const value: unknown = JSON.parse(content);
    if (!Array.isArray(value) || !value.every(isSessionStoreEntry)) {
      throw new Error(`[claude-code-session-store] invalid store file: ${filePath}`);
    }
    return value;
  };

  private writeEntries = async (
    filePath: string,
    entries: SessionStoreEntry[],
  ): Promise<void> => {
    await mkdir(this.rootDir, { recursive: true, mode: 0o700 });
    await chmod(this.rootDir, 0o700);
    const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, JSON.stringify(entries), {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      await rename(temporaryPath, filePath);
    } finally {
      await rm(temporaryPath, { force: true });
    }
  };

  private loadLegacyTranscript = async (
    sessionId: string,
  ): Promise<SessionStoreEntry[] | null> => {
    if (basename(sessionId) !== sessionId) {
      return null;
    }

    const candidates: Array<{ filePath: string; modifiedAt: number }> = [];
    for (const configDir of this.legacyConfigDirs) {
      const projectsDir = join(configDir, "projects");
      let projectDirs;
      try {
        projectDirs = await readdir(projectsDir, { withFileTypes: true });
      } catch (error) {
        if (isMissingFileError(error)) {
          continue;
        }
        throw error;
      }

      for (const projectDir of projectDirs) {
        if (!projectDir.isDirectory()) {
          continue;
        }
        const filePath = join(projectsDir, projectDir.name, `${sessionId}.jsonl`);
        try {
          candidates.push({ filePath, modifiedAt: (await stat(filePath)).mtimeMs });
        } catch (error) {
          if (!isMissingFileError(error)) {
            throw error;
          }
        }
      }
    }

    const newestCandidate = candidates.sort((left, right) => right.modifiedAt - left.modifiedAt)[0];
    if (!newestCandidate) {
      return null;
    }
    return parseJsonLines(await readFile(newestCandidate.filePath, "utf8"), newestCandidate.filePath);
  };

  private resolveFilePath = (key: SessionKey): string => {
    const digest = createHash("sha256")
      .update(JSON.stringify([key.projectKey, key.sessionId, key.subpath ?? null]))
      .digest("hex");
    return join(this.rootDir, `${digest}.json`);
  };
}

export function createClaudeCodeSessionStore(config: {
  env?: Record<string, string>;
  sessionRuntimeId?: string | null;
}): SessionStore {
  const env = { ...process.env, ...(config.env ?? {}) };
  const nextclawHome = resolve(env.NEXTCLAW_HOME?.trim() || join(homedir(), NEXTCLAW_DEFAULT_HOME_DIR));
  const configuredClaudeDir = env.CLAUDE_CONFIG_DIR?.trim();
  const legacyConfigDirs = [
    configuredClaudeDir,
    process.env.CLAUDE_CONFIG_DIR?.trim(),
    join(nextclawHome, "runtime", "claude-code"),
    join(homedir(), ".claude"),
  ].filter((value): value is string => Boolean(value));

  return new ClaudeCodeSessionStore({
    rootDir: join(nextclawHome, "runtime", SESSION_STORE_DIR_NAME),
    resumeSessionId: config.sessionRuntimeId,
    legacyConfigDirs,
  });
}

function parseJsonLines(content: string, filePath: string): SessionStoreEntry[] {
  return content
    .split("\n")
    .filter((line) => line.trim())
    .map((line, index) => {
      const value: unknown = JSON.parse(line);
      if (!isSessionStoreEntry(value)) {
        throw new Error(
          `[claude-code-session-store] invalid transcript entry at ${filePath}:${index + 1}`,
        );
      }
      return value;
    });
}

function isSessionStoreEntry(value: unknown): value is SessionStoreEntry {
  return Boolean(value) && typeof value === "object" &&
    typeof (value as { type?: unknown }).type === "string";
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(error) && typeof error === "object" &&
    (error as { code?: unknown }).code === "ENOENT";
}
