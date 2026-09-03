import { mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

export function createIssueWatcherKeyValueApp(workDirectory, componentPath) {
  return {
    id: "smoke-standard-wasi-keyvalue",
    componentPath,
    dataDirectory: path.join(workDirectory, "smoke-standard-wasi-keyvalue"),
    storageEnabled: true,
    allowedDomains: ["api.github.com"],
  };
}

export async function seedIssueWatcherKeyValueSnapshot(dataDirectory) {
  const snapshot = {
    repository: "nextclaw/deterministic-smoke",
    issues: [{
      number: 165,
      title: "standard WASI key-value scheduling",
      state: "open",
      url: "https://github.com/Peiiii/nextclaw/issues/165",
      updatedAt: "2026-09-03T00:00:00Z",
      author: "nextclaw-smoke",
      labels: ["runtime"],
    }],
    syncedAtEpochMs: 1_788_393_600_000,
    source: "deterministic-smoke",
  };

  await mkdir(dataDirectory, { recursive: true });
  const database = new DatabaseSync(path.join(dataDirectory, "portable-kv.sqlite"));
  try {
    database.exec(`
      CREATE TABLE spin_key_value (
        store TEXT NOT NULL,
        key TEXT NOT NULL,
        value BLOB NOT NULL,
        PRIMARY KEY (store, key)
      )
    `);
    database.prepare("INSERT INTO spin_key_value (store, key, value) VALUES (?, ?, ?)")
      .run("default", "github-issues/snapshot", Buffer.from(JSON.stringify(snapshot)));
  } finally {
    database.close();
  }
  return snapshot;
}

export function assertIssueWatcherKeyValueResult(response, snapshot, phase) {
  const result = response.result;
  const succeeded = response.status === undefined ? response.ok : response.status === "succeeded";
  if (!succeeded
    || result?.persistedBy !== "wasi:keyvalue/store"
    || result?.repository !== snapshot.repository
    || result?.issues?.[0]?.number !== 165) {
    throw new Error(`standard WASI key-value ${phase} failed: ${JSON.stringify(response)}`);
  }
}

export async function verifyIssueWatcherKeyValueJob(app, startJob) {
  const snapshot = await seedIssueWatcherKeyValueSnapshot(app.dataDirectory);
  const job = await startJob(app, "issues_list", { state: "all" });
  assertIssueWatcherKeyValueResult(await job.terminal, snapshot, "job read");
  return snapshot;
}

export async function verifyIssueWatcherKeyValueRestart(session, app, snapshot) {
  const response = await session.request({
    requestId: randomUUID(), operation: "invoke", app,
    actionName: "issues_list", input: { state: "all" },
  });
  assertIssueWatcherKeyValueResult(response, snapshot, "restart read");
}
