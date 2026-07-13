import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { SessionKey, SessionStoreEntry } from "@anthropic-ai/claude-agent-sdk";
import { ClaudeCodeSessionStore } from "./claude-code-session.store.js";

const SESSION_ID = "b98596b8-2b88-4a54-8f7b-c0ac5bb7d46c";
const SESSION_KEY: SessionKey = {
  projectKey: "/tmp/nextclaw-workspace",
  sessionId: SESSION_ID,
};

describe("ClaudeCodeSessionStore", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("persists entries across store instances and deduplicates UUID entries", async () => {
    const rootDir = createTempDir();
    tempDirs.push(rootDir);
    const firstEntry: SessionStoreEntry = {
      type: "user",
      uuid: "user-1",
      message: { content: "remember NC-CLAUDE-7429" },
    };
    const store = new ClaudeCodeSessionStore({ rootDir });

    await store.append(SESSION_KEY, [firstEntry]);
    await store.append(SESSION_KEY, [
      { ...firstEntry, message: { content: "duplicate" } },
      { type: "mode", mode: "default" },
    ]);
    await store.append(SESSION_KEY, [{ type: "mode", mode: "default" }]);

    const reloadedStore = new ClaudeCodeSessionStore({ rootDir });
    expect(await reloadedStore.load(SESSION_KEY)).toEqual([
      firstEntry,
      { type: "mode", mode: "default" },
      { type: "mode", mode: "default" },
    ]);
  });

  it("imports an existing Claude transcript before resuming across config directories", async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    const rootDir = join(tempDir, "store");
    const legacyConfigDir = join(tempDir, "claude-config");
    const legacyProjectDir = join(legacyConfigDir, "projects", "project-a");
    const entries: SessionStoreEntry[] = [
      { type: "user", uuid: "user-1", message: { content: "remember NC-CLAUDE-7429" } },
      { type: "assistant", uuid: "assistant-1", message: { content: "READY" } },
    ];
    mkdirSync(legacyProjectDir, { recursive: true });
    writeFileSync(
      join(legacyProjectDir, `${SESSION_ID}.jsonl`),
      `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`,
      "utf8",
    );

    const migratingStore = new ClaudeCodeSessionStore({
      rootDir,
      resumeSessionId: SESSION_ID,
      legacyConfigDirs: [join(tempDir, "missing-config"), legacyConfigDir],
    });
    expect(await migratingStore.load(SESSION_KEY)).toEqual(entries);

    rmSync(legacyConfigDir, { recursive: true, force: true });
    expect(await new ClaudeCodeSessionStore({ rootDir }).load(SESSION_KEY)).toEqual(entries);
  });
});

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), "nextclaw-claude-session-store-"));
}
