import { mkdtemp, readdir, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NcpMessage } from "@nextclaw/ncp";
import { NcpAgentSessionMessageProjectionStore } from "./ncp-agent-session-message-projection.store.js";
import type { NcpAgentSessionMessageProjectionPersistenceStore } from "./ncp-agent-session-message-projection-persistence.store.js";

const sessionId = "session-1";

function fileSystemError(code: "EACCES" | "EBUSY" | "EPERM" | "EIO"): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

type ProjectionPersistenceInternals = {
  renameMeta: (from: string, to: string) => Promise<void>;
  waitForMetaRenameRetry: (delayMs: number) => Promise<void>;
  rebuild: (...args: unknown[]) => Promise<void>;
};

function message(index: number, text = `message-${index}`): NcpMessage {
  return {
    id: `message-${index}`,
    sessionId,
    role: index % 2 === 0 ? "assistant" : "user",
    status: "final",
    parts: [{ type: "text", text }],
    timestamp: `2026-07-18T00:00:${String(index).padStart(2, "0")}.000Z`,
  };
}

function persistence(store: NcpAgentSessionMessageProjectionStore): NcpAgentSessionMessageProjectionPersistenceStore {
  return (store as unknown as { persistence: NcpAgentSessionMessageProjectionPersistenceStore }).persistence;
}

let tempDir: string | null = null;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe("NcpAgentSessionMessageProjectionStore recovery", () => {
  it.each(["EPERM", "EACCES", "EBUSY"] as const)(
    "retries transient %s metadata rename failures without leaving a temp file",
    async (code) => {
      tempDir = await mkdtemp(join(tmpdir(), "nextclaw-message-projection-"));
      const store = new NcpAgentSessionMessageProjectionStore(tempDir);
      await store.rebuild({ sessionId, messages: [message(1)], projectedJournalOffset: 100 });
      const internals = persistence(store) as unknown as ProjectionPersistenceInternals;
      const renameMeta = vi.spyOn(internals, "renameMeta")
        .mockRejectedValueOnce(fileSystemError(code))
        .mockRejectedValueOnce(fileSystemError(code))
        .mockImplementation(async (from, to) => await rename(from, to));
      const wait = vi.spyOn(internals, "waitForMetaRenameRetry").mockResolvedValue();

      await store.updateContextWindow(sessionId, { usedContextTokens: 20 });

      expect(renameMeta).toHaveBeenCalledTimes(3);
      expect(wait).toHaveBeenCalledTimes(2);
      await expect(store.readMeta(sessionId)).resolves.toMatchObject({ contextWindow: { usedContextTokens: 20 } });
      await expect(readdir(join(tempDir, ".message-projections", sessionId))).resolves.not.toContain(
        expect.stringMatching(/\.tmp$/),
      );
    },
  );

  it("does not retry a non-retryable metadata rename failure", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-message-projection-"));
    const store = new NcpAgentSessionMessageProjectionStore(tempDir);
    await store.rebuild({ sessionId, messages: [message(1)], projectedJournalOffset: 100 });
    const internals = persistence(store) as unknown as ProjectionPersistenceInternals;
    const renameMeta = vi.spyOn(internals, "renameMeta").mockRejectedValue(fileSystemError("EIO"));
    const wait = vi.spyOn(internals, "waitForMetaRenameRetry");

    await store.updateContextWindow(sessionId, { usedContextTokens: 20 });

    expect(renameMeta).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
    await expect(readdir(join(tempDir, ".message-projections", sessionId))).resolves.not.toContain(
      expect.stringMatching(/\.tmp$/),
    );
  });

  it("serializes same-session mutations and makes the final context update win", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-message-projection-"));
    const store = new NcpAgentSessionMessageProjectionStore(tempDir);
    await store.rebuild({ sessionId, messages: [message(1)], projectedJournalOffset: 100 });
    const internals = persistence(store) as unknown as ProjectionPersistenceInternals;
    let releaseFirstRename: (() => void) | undefined;
    const firstRenameStarted = new Promise<void>((resolve) => {
      vi.spyOn(internals, "renameMeta")
        .mockImplementationOnce(async () => {
          resolve();
          await new Promise<void>((release) => { releaseFirstRename = release; });
        })
        .mockImplementation(async (from, to) => await rename(from, to));
    });

    const first = store.updateContextWindow(sessionId, { revision: 1 });
    await firstRenameStarted;
    const second = store.updateContextWindow(sessionId, { revision: 2 });
    releaseFirstRename?.();
    await Promise.all([first, second]);

    await expect(store.readMeta(sessionId)).resolves.toMatchObject({ contextWindow: { revision: 2 } });
    expect((store as unknown as { operationChains: Map<string, Promise<void>> }).operationChains.size).toBe(0);
  });

  it("lets different sessions proceed while another session is waiting to commit", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-message-projection-"));
    const secondSessionId = "session-2";
    const store = new NcpAgentSessionMessageProjectionStore(tempDir);
    await Promise.all([
      store.rebuild({ sessionId, messages: [message(1)], projectedJournalOffset: 100 }),
      store.rebuild({
        sessionId: secondSessionId,
        messages: [{ ...message(2), id: "session-2-message-1", sessionId: secondSessionId }],
        projectedJournalOffset: 100,
      }),
    ]);
    const internals = persistence(store) as unknown as ProjectionPersistenceInternals;
    let releaseFirstRename: (() => void) | undefined;
    const firstRenameStarted = new Promise<void>((resolve) => {
      vi.spyOn(internals, "renameMeta")
        .mockImplementationOnce(async () => {
          resolve();
          await new Promise<void>((release) => { releaseFirstRename = release; });
        })
        .mockImplementation(async (from, to) => await rename(from, to));
    });

    const blocked = store.updateContextWindow(sessionId, { revision: 1 });
    await firstRenameStarted;
    await expect(store.updateContextWindow(secondSessionId, { revision: 2 })).resolves.toBeUndefined();
    releaseFirstRename?.();
    await blocked;

    await expect(store.readMeta(secondSessionId)).resolves.toMatchObject({ contextWindow: { revision: 2 } });
  });

  it("falls back to journal pages without writes after a projection mutation degrades", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-message-projection-"));
    const journalMessages = [1, 2, 3, 4, 5].map((index) => message(index));
    const store = new NcpAgentSessionMessageProjectionStore(tempDir, {
      loadSession: async () => ({
        record: { sessionId, messages: journalMessages, createdAt: "2026-07-18T00:00:00.000Z", updatedAt: "2026-07-18T00:00:05.000Z", metadata: {} },
        nextSeq: 1, journalOffset: 500, projectedJournalOffset: 500,
      }),
    });
    await store.rebuild({ sessionId, messages: journalMessages, projectedJournalOffset: 500 });
    const internals = persistence(store) as unknown as ProjectionPersistenceInternals;
    vi.spyOn(internals, "renameMeta").mockRejectedValue(fileSystemError("EPERM"));
    vi.spyOn(internals, "waitForMetaRenameRetry").mockResolvedValue();

    await store.updateContextWindow(sessionId, { revision: 1 });
    const rebuild = vi.spyOn(internals, "rebuild");
    const newest = await store.listPage({ sessionId, limit: 2 });
    const previous = await store.listPage({ sessionId, limit: 2, cursor: newest?.pageInfo.startCursor ?? undefined });

    expect(newest).toMatchObject({ total: 5, messages: [{ id: "message-4" }, { id: "message-5" }] });
    expect(previous).toMatchObject({ messages: [{ id: "message-2" }, { id: "message-3" }] });
    expect(rebuild).not.toHaveBeenCalled();
  });

  it("recovers the projection on a later mutation after degradation", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-message-projection-"));
    const journalMessages = [message(1), message(2), message(3)];
    const store = new NcpAgentSessionMessageProjectionStore(tempDir, {
      loadSession: async () => ({
        record: { sessionId, messages: journalMessages, createdAt: "2026-07-18T00:00:00.000Z", updatedAt: "2026-07-18T00:00:03.000Z", metadata: {} },
        nextSeq: 1, journalOffset: 300, projectedJournalOffset: 300,
      }),
    });
    await store.rebuild({ sessionId, messages: journalMessages.slice(0, 2), projectedJournalOffset: 200 });
    const internals = persistence(store) as unknown as ProjectionPersistenceInternals;
    const renameMeta = vi.spyOn(internals, "renameMeta").mockRejectedValue(fileSystemError("EACCES"));
    vi.spyOn(internals, "waitForMetaRenameRetry").mockResolvedValue();
    await store.updateContextWindow(sessionId, { revision: 1 });
    renameMeta.mockRestore();

    await expect(store.synchronize({
      sessionId,
      messages: [message(3)],
      projectedJournalOffset: 300,
    })).resolves.toBe(true);
    await expect(store.readPage({ sessionId, limit: 10 })).resolves.toMatchObject({
      total: 3,
      messages: [{ id: "message-1" }, { id: "message-2" }, { id: "message-3" }],
    });
  });

});
