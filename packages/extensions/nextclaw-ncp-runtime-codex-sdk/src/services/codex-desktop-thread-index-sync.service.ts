import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import {
  findCodexRolloutPathForThreadId,
  readCodexRolloutSummary,
  type CodexRolloutSummary,
} from "@/utils/codex-rollout-thread-summary.utils.js";

const THREAD_INDEX_SYNC_ENV = "NEXTCLAW_CODEX_DESKTOP_THREAD_INDEX_SYNC";
const CODEX_SQLITE_DATABASE = "state_5.sqlite";
const CODEX_SESSIONS_DIRECTORY = "sessions";
const REQUIRED_THREAD_COLUMNS = [
  "id",
  "rollout_path",
  "updated_at",
  "tokens_used",
  "has_user_event",
] as const;
const THREAD_INSERT_COLUMN_ORDER = [
  "id",
  "rollout_path",
  "created_at",
  "updated_at",
  "source",
  "model_provider",
  "cwd",
  "title",
  "sandbox_policy",
  "approval_mode",
  "tokens_used",
  "has_user_event",
  "archived",
  "cli_version",
  "first_user_message",
  "memory_mode",
  "model",
  "reasoning_effort",
  "created_at_ms",
  "updated_at_ms",
  "preview",
] as const;

type CodexDesktopStatement = {
  all: (...params: unknown[]) => unknown[];
  get: (...params: unknown[]) => unknown;
  run: (...params: unknown[]) => unknown;
};

type CodexDesktopDatabase = {
  close: () => void;
  exec: (sql: string) => void;
  prepare: (sql: string) => CodexDesktopStatement;
};

type CodexDesktopDatabaseSyncCtor = new (path: string) => CodexDesktopDatabase;

type CodexDesktopThreadRow = {
  hasUserEvent?: number;
  rolloutPath?: string;
  tokensUsed?: number;
  updatedAt?: number;
  updatedAtMs?: number | null;
};

export interface CodexDesktopThreadIndexSync {
  syncThread(params: { threadId?: string | null }): Promise<void>;
}

export interface CodexDesktopThreadIndexSyncServiceOptions {
  databasePath?: string;
  env?: NodeJS.ProcessEnv;
  homeDirectory?: string;
  loadDatabaseSync?: () => Promise<CodexDesktopDatabaseSyncCtor>;
  logger?: Pick<Console, "error" | "warn">;
  sessionsDirectory?: string;
}

export class CodexDesktopThreadIndexSyncService implements CodexDesktopThreadIndexSync {
  private readonly databasePath?: string;
  private readonly env: NodeJS.ProcessEnv;
  private readonly homeDirectory: string;
  private readonly loadDatabaseSync: () => Promise<CodexDesktopDatabaseSyncCtor>;
  private readonly logger: Pick<Console, "error" | "warn">;
  private readonly sessionsDirectory?: string;

  constructor(options: CodexDesktopThreadIndexSyncServiceOptions = {}) {
    this.databasePath = options.databasePath;
    this.env = options.env ?? process.env;
    this.homeDirectory = options.homeDirectory ?? homedir();
    this.loadDatabaseSync =
      options.loadDatabaseSync ?? loadCodexDesktopDatabaseSync;
    this.logger = options.logger ?? console;
    this.sessionsDirectory = options.sessionsDirectory;
  }

  syncThread = async (params: { threadId?: string | null }): Promise<void> => {
    if (isDisabled(this.env[THREAD_INDEX_SYNC_ENV])) {
      return;
    }
    const threadId = readString(params.threadId);
    if (!threadId) {
      return;
    }
    try {
      await this.syncThreadIndex(threadId);
    } catch (error) {
      this.logger.error(
        `[nextclaw-codex-app-server] failed to sync Codex Desktop thread index: ${formatError(error)}`,
      );
    }
  };

  private syncThreadIndex = async (threadId: string): Promise<void> => {
    const databasePath = this.resolveDatabasePath();
    if (!existsSync(databasePath)) {
      return;
    }
    const DatabaseSync = await this.loadDatabaseSync();
    const database = new DatabaseSync(databasePath);
    try {
      database.exec("PRAGMA busy_timeout = 100;");
      const columns = readThreadTableColumns(database);
      if (!hasRequiredThreadColumns(columns)) {
        this.logger.warn(
          "[nextclaw-codex-app-server] skipped Codex Desktop thread index sync: unknown threads schema.",
        );
        return;
      }
      const row = readThreadRow(database, threadId, columns);
      const rolloutPath = this.resolveRolloutPath(row, threadId);
      if (!rolloutPath) {
        return;
      }
      const summary = readCodexRolloutSummary(rolloutPath);
      if (!row) {
        this.insertThreadRow({
          columns,
          database,
          rolloutPath,
          summary,
          threadId,
        });
        return;
      }
      this.updateThreadRow({
        columns,
        database,
        rolloutPath,
        row,
        summary,
        threadId,
      });
    } finally {
      database.close();
    }
  };

  private insertThreadRow = (params: {
    columns: Set<string>;
    database: CodexDesktopDatabase;
    rolloutPath: string;
    summary: CodexRolloutSummary;
    threadId: string;
  }): void => {
    const { columns, database, rolloutPath, summary, threadId } = params;
    const sessionMeta = summary.sessionMeta;
    const cwd = readString(sessionMeta?.cwd);
    const createdAtMs =
      summary.createdAtMs ?? sessionMeta?.timestampMs ?? summary.updatedAtMs;
    const updatedAtMs = summary.updatedAtMs ?? createdAtMs;
    if (!cwd || createdAtMs === undefined || updatedAtMs === undefined) {
      return;
    }

    const firstUserMessage = limitText(summary.firstUserMessage ?? threadId);
    const valuesByColumn: Record<string, unknown> = {
      approval_mode: readString(sessionMeta?.approvalMode) ?? "never",
      archived: 0,
      cli_version: readString(sessionMeta?.cliVersion) ?? "",
      created_at: Math.floor(createdAtMs / 1000),
      created_at_ms: createdAtMs,
      cwd,
      first_user_message: firstUserMessage,
      has_user_event: summary.hasUserEvent ? 1 : 0,
      id: threadId,
      memory_mode: readString(sessionMeta?.memoryMode) ?? "enabled",
      model: readString(sessionMeta?.model) ?? null,
      model_provider: readString(sessionMeta?.modelProvider) ?? "openai",
      preview: firstUserMessage,
      reasoning_effort: readString(sessionMeta?.reasoningEffort) ?? null,
      rollout_path: rolloutPath,
      sandbox_policy:
        readString(sessionMeta?.sandboxPolicy) ??
        JSON.stringify({ type: "disabled" }),
      source: readString(sessionMeta?.source) ?? "vscode",
      title: firstUserMessage,
      tokens_used: summary.tokensUsed ?? 0,
      updated_at: Math.floor(updatedAtMs / 1000),
      updated_at_ms: updatedAtMs,
    };
    const insertColumns = THREAD_INSERT_COLUMN_ORDER.filter((column) =>
      columns.has(column),
    );
    if (!hasRequiredInsertValues(insertColumns, valuesByColumn)) {
      return;
    }
    database
      .prepare(
        `
      INSERT INTO threads (${insertColumns.join(", ")})
      VALUES (${insertColumns.map(() => "?").join(", ")})
    `,
      )
      .run(...insertColumns.map((column) => valuesByColumn[column]));
  };

  private updateThreadRow = (params: {
    columns: Set<string>;
    database: CodexDesktopDatabase;
    rolloutPath: string;
    row: CodexDesktopThreadRow;
    summary: CodexRolloutSummary;
    threadId: string;
  }): void => {
    const updates: string[] = [];
    const values: unknown[] = [];
    const { columns, database, rolloutPath, row, summary, threadId } = params;

    if (readString(row.rolloutPath) !== rolloutPath) {
      updates.push("rollout_path = ?");
      values.push(rolloutPath);
    }
    if (shouldUpdateTimestamp(row, summary)) {
      const updatedAtMs = summary.updatedAtMs;
      if (updatedAtMs !== undefined) {
        updates.push("updated_at = ?");
        values.push(Math.floor(updatedAtMs / 1000));
        if (columns.has("updated_at_ms")) {
          updates.push("updated_at_ms = ?");
          values.push(updatedAtMs);
        }
      }
    }
    if (
      summary.tokensUsed !== undefined &&
      summary.tokensUsed > (readNumber(row.tokensUsed) ?? 0)
    ) {
      updates.push("tokens_used = ?");
      values.push(summary.tokensUsed);
    }
    if (summary.hasUserEvent && (readNumber(row.hasUserEvent) ?? 0) !== 1) {
      updates.push("has_user_event = ?");
      values.push(1);
    }
    if (updates.length === 0) {
      return;
    }
    database
      .prepare(`UPDATE threads SET ${updates.join(", ")} WHERE id = ?`)
      .run(...values, threadId);
  };

  private resolveRolloutPath = (
    row: CodexDesktopThreadRow | undefined,
    threadId: string,
  ): string | undefined => {
    const rolloutPath = readString(row?.rolloutPath);
    if (rolloutPath && isAbsolute(rolloutPath) && existsSync(rolloutPath)) {
      return rolloutPath;
    }
    return findCodexRolloutPathForThreadId(
      this.resolveSessionsDirectory(),
      threadId,
    );
  };

  private resolveDatabasePath = (): string => {
    if (this.databasePath) {
      return this.databasePath;
    }
    return join(this.resolveCodexHome(), "sqlite", CODEX_SQLITE_DATABASE);
  };

  private resolveSessionsDirectory = (): string => {
    return (
      this.sessionsDirectory ??
      join(this.resolveCodexHome(), CODEX_SESSIONS_DIRECTORY)
    );
  };

  private resolveCodexHome = (): string => {
    return readString(this.env.CODEX_HOME) ?? join(this.homeDirectory, ".codex");
  };
}

async function loadCodexDesktopDatabaseSync(): Promise<CodexDesktopDatabaseSyncCtor> {
  const moduleName = "node:sqlite";
  const module = (await import(moduleName)) as {
    DatabaseSync: CodexDesktopDatabaseSyncCtor;
  };
  return module.DatabaseSync;
}

function readThreadTableColumns(database: CodexDesktopDatabase): Set<string> {
  const rows = database.prepare("PRAGMA table_info(threads)").all();
  const columns = new Set<string>();
  for (const row of rows) {
    const column = readString((row as { name?: unknown }).name);
    if (column) {
      columns.add(column);
    }
  }
  return columns;
}

function hasRequiredThreadColumns(columns: Set<string>): boolean {
  return REQUIRED_THREAD_COLUMNS.every((column) => columns.has(column));
}

function readThreadRow(
  database: CodexDesktopDatabase,
  threadId: string,
  columns: Set<string>,
): CodexDesktopThreadRow | undefined {
  const selectedColumns = [
    "rollout_path AS rolloutPath",
    "updated_at AS updatedAt",
    "tokens_used AS tokensUsed",
    "has_user_event AS hasUserEvent",
  ];
  if (columns.has("updated_at_ms")) {
    selectedColumns.push("updated_at_ms AS updatedAtMs");
  }
  const row = database
    .prepare(
      `
    SELECT ${selectedColumns.join(", ")}
    FROM threads
    WHERE id = ?
  `,
    )
    .get(threadId);
  return isRecord(row) ? (row as CodexDesktopThreadRow) : undefined;
}

function shouldUpdateTimestamp(
  row: CodexDesktopThreadRow,
  summary: CodexRolloutSummary,
): boolean {
  const nextUpdatedAtMs = summary.updatedAtMs;
  if (nextUpdatedAtMs === undefined) {
    return false;
  }
  const currentUpdatedAtMs = readNumber(row.updatedAtMs);
  if (currentUpdatedAtMs !== undefined) {
    return nextUpdatedAtMs > currentUpdatedAtMs;
  }
  return Math.floor(nextUpdatedAtMs / 1000) > (readNumber(row.updatedAt) ?? 0);
}

function hasRequiredInsertValues(
  columns: readonly string[],
  valuesByColumn: Record<string, unknown>,
): boolean {
  return REQUIRED_THREAD_COLUMNS.every((column) => columns.includes(column)) &&
    ["created_at", "source", "model_provider", "cwd", "title"].every(
      (column) => columns.includes(column) && valuesByColumn[column] != null,
    );
}

function limitText(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > 2_000
    ? `${normalized.slice(0, 2_000).trimEnd()}...`
    : normalized;
}

function readNumber(value: unknown, fallback?: number): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isDisabled(value: string | undefined): boolean {
  const normalized = readString(value)?.toLowerCase();
  return normalized === "0" || normalized === "false" || normalized === "off";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
