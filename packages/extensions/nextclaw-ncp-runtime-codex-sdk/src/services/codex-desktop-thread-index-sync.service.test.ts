import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CodexDesktopThreadIndexSyncService } from "./codex-desktop-thread-index-sync.service.js";

type TestStatement = {
  all: (...params: unknown[]) => unknown[];
  get: (...params: unknown[]) => unknown;
  run: (...params: unknown[]) => unknown;
};

type TestDatabase = {
  close: () => void;
  exec: (sql: string) => void;
  prepare: (sql: string) => TestStatement;
};

type TestDatabaseSyncCtor = new (path: string) => TestDatabase;

let tempDir: string | null = null;

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe("CodexDesktopThreadIndexSyncService", () => {
  it("syncs stale Codex Desktop thread metadata from the rollout file", async () => {
    const DatabaseSync = await loadTestDatabaseSync();
    const paths = createThreadDatabase(DatabaseSync);
    writeRollout(paths.rolloutPath);

    const service = new CodexDesktopThreadIndexSyncService({
      databasePath: paths.databasePath,
      loadDatabaseSync: async () => DatabaseSync,
    });

    await service.syncThread({ threadId: "thread-1" });

    expect(readThreadRow(DatabaseSync, paths.databasePath)).toEqual({
      hasUserEvent: 1,
      tokensUsed: 75308,
      updatedAt: 1781624121,
      updatedAtMs: 1781624121656,
    });
  });

  it("can be disabled through an explicit environment switch", async () => {
    const DatabaseSync = await loadTestDatabaseSync();
    const paths = createThreadDatabase(DatabaseSync);
    writeRollout(paths.rolloutPath);

    const service = new CodexDesktopThreadIndexSyncService({
      databasePath: paths.databasePath,
      env: { NEXTCLAW_CODEX_DESKTOP_THREAD_INDEX_SYNC: "0" },
      loadDatabaseSync: async () => DatabaseSync,
    });

    await service.syncThread({ threadId: "thread-1" });

    expect(readThreadRow(DatabaseSync, paths.databasePath)).toEqual({
      hasUserEvent: 0,
      tokensUsed: 25090,
      updatedAt: 1781622227,
      updatedAtMs: 1781622227602,
    });
  });

  it("materializes a missing Codex Desktop thread row from the rollout file", async () => {
    const DatabaseSync = await loadTestDatabaseSync();
    const paths = createThreadDatabase(DatabaseSync, { insertThread: false });
    writeRollout(paths.rolloutPath);

    const service = new CodexDesktopThreadIndexSyncService({
      databasePath: paths.databasePath,
      loadDatabaseSync: async () => DatabaseSync,
      sessionsDirectory: paths.sessionsDirectory,
    });

    await service.syncThread({ threadId: "thread-1" });

    expect(readThreadMetadata(DatabaseSync, paths.databasePath)).toEqual({
      approvalMode: "never",
      archived: 0,
      cliVersion: "0.139.0",
      createdAt: 1781622224,
      createdAtMs: 1781622224463,
      cwd: "/tmp/nextclaw-project",
      firstUserMessage: "hello",
      hasUserEvent: 1,
      id: "thread-1",
      memoryMode: "enabled",
      model: null,
      modelProvider: "openai",
      preview: "hello",
      reasoningEffort: null,
      rolloutPath: paths.rolloutPath,
      sandboxPolicy: "{\"type\":\"disabled\"}",
      source: "vscode",
      title: "hello",
      tokensUsed: 75308,
      updatedAt: 1781624121,
      updatedAtMs: 1781624121656,
    });
  });
});

async function loadTestDatabaseSync(): Promise<TestDatabaseSyncCtor> {
  const moduleName = "node:sqlite";
  const module = (await import(moduleName)) as {
    DatabaseSync: TestDatabaseSyncCtor;
  };
  return module.DatabaseSync;
}

function createThreadDatabase(DatabaseSync: TestDatabaseSyncCtor): {
  databasePath: string;
  rolloutPath: string;
  sessionsDirectory: string;
};
function createThreadDatabase(
  DatabaseSync: TestDatabaseSyncCtor,
  options: { insertThread?: boolean },
): {
  databasePath: string;
  rolloutPath: string;
  sessionsDirectory: string;
};
function createThreadDatabase(
  DatabaseSync: TestDatabaseSyncCtor,
  options: { insertThread?: boolean } = {},
): {
  databasePath: string;
  rolloutPath: string;
  sessionsDirectory: string;
} {
  tempDir = mkdtempSync(join(tmpdir(), "nextclaw-codex-thread-index-"));
  const databasePath = join(tempDir, "state_5.sqlite");
  const sessionsDirectory = join(tempDir, "sessions");
  const rolloutPath = join(
    sessionsDirectory,
    "2026",
    "06",
    "16",
    "rollout-2026-06-16T15-03-44-thread-1.jsonl",
  );
  mkdirSync(dirname(rolloutPath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  try {
    database.exec(`
      CREATE TABLE threads (
        id TEXT PRIMARY KEY,
        rollout_path TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        source TEXT NOT NULL,
        model_provider TEXT NOT NULL,
        cwd TEXT NOT NULL,
        title TEXT NOT NULL,
        sandbox_policy TEXT NOT NULL,
        approval_mode TEXT NOT NULL,
        tokens_used INTEGER NOT NULL DEFAULT 0,
        has_user_event INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0,
        archived_at INTEGER,
        git_sha TEXT,
        git_branch TEXT,
        git_origin_url TEXT,
        cli_version TEXT NOT NULL DEFAULT '',
        first_user_message TEXT NOT NULL DEFAULT '',
        agent_nickname TEXT,
        agent_role TEXT,
        memory_mode TEXT NOT NULL DEFAULT 'enabled',
        model TEXT,
        reasoning_effort TEXT,
        agent_path TEXT,
        created_at_ms INTEGER,
        updated_at_ms INTEGER,
        thread_source TEXT,
        preview TEXT NOT NULL DEFAULT ''
      );
    `);
    if (options.insertThread === false) {
      return { databasePath, rolloutPath, sessionsDirectory };
    }
    database
      .prepare(
        `
      INSERT INTO threads (
        id,
        rollout_path,
        created_at,
        updated_at,
        source,
        model_provider,
        cwd,
        title,
        sandbox_policy,
        approval_mode,
        tokens_used,
        has_user_event,
        archived,
        cli_version,
        first_user_message,
        memory_mode,
        model,
        reasoning_effort,
        created_at_ms,
        updated_at_ms,
        preview
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        "thread-1",
        rolloutPath,
        1781622227,
        1781622227,
        "vscode",
        "openai",
        "/tmp/nextclaw-project",
        "old title",
        "{\"type\":\"disabled\"}",
        "never",
        25090,
        0,
        0,
        "0.139.0",
        "old title",
        "enabled",
        "gpt-5.5",
        "high",
        1781622227602,
        1781622227602,
        "old title",
      );
  } finally {
    database.close();
  }
  return { databasePath, rolloutPath, sessionsDirectory };
}

function writeRollout(rolloutPath: string): void {
  const lines = [
    {
      timestamp: "2026-06-16T15:03:44.463Z",
      type: "session_meta",
      payload: {
        id: "thread-1",
        timestamp: "2026-06-16T15:03:44.463Z",
        cwd: "/tmp/nextclaw-project",
        cli_version: "0.139.0",
        source: "vscode",
        model_provider: "openai",
      },
    },
    {
      timestamp: "2026-06-16T15:03:44.463Z",
      type: "response_item",
      payload: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "project context" }],
      },
    },
    {
      timestamp: "2026-06-16T15:03:44.464Z",
      type: "event_msg",
      payload: {
        type: "user_message",
        message: "hello",
      },
    },
    {
      timestamp: "2026-06-16T15:35:21.651Z",
      type: "event_msg",
      payload: {
        type: "token_count",
        info: {
          total_token_usage: {
            total_tokens: 75308,
          },
        },
      },
    },
    {
      timestamp: "2026-06-16T15:35:21.656Z",
      type: "event_msg",
      payload: {
        type: "task_complete",
      },
    },
  ];
  writeFileSync(
    rolloutPath,
    `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`,
    "utf8",
  );
}

function readThreadRow(
  DatabaseSync: TestDatabaseSyncCtor,
  databasePath: string,
): Record<string, unknown> | undefined {
  const database = new DatabaseSync(databasePath);
  try {
    return database
      .prepare(
        `
      SELECT
        updated_at AS updatedAt,
        updated_at_ms AS updatedAtMs,
        tokens_used AS tokensUsed,
        has_user_event AS hasUserEvent
      FROM threads
      WHERE id = ?
    `,
      )
      .get("thread-1") as Record<string, unknown> | undefined;
  } finally {
    database.close();
  }
}

function readThreadMetadata(
  DatabaseSync: TestDatabaseSyncCtor,
  databasePath: string,
): Record<string, unknown> | undefined {
  const database = new DatabaseSync(databasePath);
  try {
    return database
      .prepare(
        `
      SELECT
        id,
        rollout_path AS rolloutPath,
        created_at AS createdAt,
        updated_at AS updatedAt,
        source,
        model_provider AS modelProvider,
        cwd,
        title,
        sandbox_policy AS sandboxPolicy,
        approval_mode AS approvalMode,
        tokens_used AS tokensUsed,
        has_user_event AS hasUserEvent,
        archived,
        cli_version AS cliVersion,
        first_user_message AS firstUserMessage,
        memory_mode AS memoryMode,
        model,
        reasoning_effort AS reasoningEffort,
        created_at_ms AS createdAtMs,
        updated_at_ms AS updatedAtMs,
        preview
      FROM threads
      WHERE id = ?
    `,
      )
      .get("thread-1") as Record<string, unknown> | undefined;
  } finally {
    database.close();
  }
}
