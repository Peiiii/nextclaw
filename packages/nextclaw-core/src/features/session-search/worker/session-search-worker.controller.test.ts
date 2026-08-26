import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionSearchWorkerRuntimeService } from "./services/session-search-worker-runtime.service.js";
import { SessionSearchFileScannerService } from "./session-search-file-scanner.service.js";
import { SessionSearchWorkerIndexerService } from "./session-search-worker-indexer.service.js";
import { SessionSearchWorkerController } from "./session-search-worker.controller.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

async function waitUntil(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Condition was not reached.");
}

describe("SessionSearchWorkerController", () => {
  it("preserves the original startup failure when the worker exits during start", async () => {
    const listeners = new Map<string, (value: never) => void>();
    const terminate = vi.fn(async () => undefined);
    const worker = {
      on: vi.fn((event: "message" | "error" | "exit", listener: (value: never) => void) => {
        listeners.set(event, listener);
        return worker;
      }),
      postMessage: vi.fn(() => {
        listeners.get("exit")?.(1 as never);
      }),
      terminate
    };
    const controller = new SessionSearchWorkerController({
      databasePath: "/tmp/session-search.sqlite",
      sessionsDir: "/tmp/sessions",
      createWorker: () => worker
    });

    await expect(controller.start()).rejects.toThrow("Session search worker exited with code 1.");
    expect(terminate).toHaveBeenCalledTimes(1);
  });
});

describe("SessionSearchWorkerIndexerService", () => {
  it("resolves one canonical session file without reading the directory", async () => {
    const directory = await mkdtemp(join(tmpdir(), "nextclaw-session-search-scanner-"));
    try {
      await writeFile(
        join(directory, "agent_main_ui.jsonl"),
        `${JSON.stringify({
          _type: "metadata",
          session_id: "agent:main:ui",
          updated_at: "2026-08-26T00:00:00.000Z",
        })}\n`,
      );
      const scanner = new SessionSearchFileScannerService(directory);

      await expect(scanner.getSessionFileSummary("agent:main:ui")).resolves.toMatchObject({
        sessionId: "agent:main:ui",
        path: join(directory, "agent_main_ui.jsonl"),
      });
      await expect(scanner.getSessionFileSummary("../outside")).resolves.toBeNull();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("indexes one updated session without rescanning the session directory", async () => {
    const summary = {
      sessionId: "session-1",
      path: "/tmp/session-1.jsonl",
      updatedAt: "2026-08-26T00:00:00.000Z",
      contentHash: "hash",
    };
    const scanner = {
      listSessionFiles: vi.fn(() => {
        throw new Error("full scan must not run");
      }),
      getSessionFileSummary: vi.fn(async () => summary),
      readSession: vi.fn(async () => ({
        sessionId: "session-1",
        messages: [{ role: "user", content: "hello", timestamp: summary.updatedAt }],
        metadata: {},
        updatedAt: summary.updatedAt,
      })),
    };
    const store = {
      deleteDocument: vi.fn(async () => undefined),
      upsertDocumentWithMetadata: vi.fn(async () => undefined),
    };
    const indexer = new SessionSearchWorkerIndexerService({
      scanner: scanner as never,
      store: store as never,
    });

    await indexer.indexSession("session-1");

    expect(scanner.getSessionFileSummary).toHaveBeenCalledWith("session-1");
    expect(scanner.listSessionFiles).not.toHaveBeenCalled();
    expect(store.upsertDocumentWithMetadata).toHaveBeenCalledTimes(1);
  });
});

describe("SessionSearchWorkerRuntimeService", () => {
  it("serializes startup reconciliation and coalesces repeated session updates", async () => {
    const reconcile = createDeferred();
    const firstIncremental = createDeferred();
    const indexSession = vi
      .spyOn(SessionSearchWorkerIndexerService.prototype, "indexSession")
      .mockImplementationOnce(async () => await firstIncremental.promise)
      .mockResolvedValue(undefined);
    vi.spyOn(SessionSearchWorkerIndexerService.prototype, "reconcileAll")
      .mockImplementation(async () => {
        await reconcile.promise;
        return { scanned: 0, indexed: 0, skipped: 0, deleted: 0, total: 0 };
      });
    const directory = await mkdtemp(join(tmpdir(), "nextclaw-session-search-"));
    const events: Array<{ type: string; state?: string }> = [];
    const runtime = new SessionSearchWorkerRuntimeService((event) => {
      events.push(event);
    });

    await runtime.handleRequest({
      id: "start",
      type: "start",
      payload: { sessionsDir: directory, databasePath: join(directory, "search.sqlite") },
    });
    for (let index = 0; index < 50; index += 1) {
      await runtime.handleRequest({
        id: `before-${index}`,
        type: "session-updated",
        payload: { sessionId: "session-1" },
      });
    }
    expect(indexSession).not.toHaveBeenCalled();

    reconcile.resolve();
    await waitUntil(() => indexSession.mock.calls.length === 1);
    for (let index = 0; index < 50; index += 1) {
      await runtime.handleRequest({
        id: `during-${index}`,
        type: "session-updated",
        payload: { sessionId: "session-1" },
      });
    }
    firstIncremental.resolve();
    await waitUntil(() => events.some((event) => event.type === "state" && event.state === "idle"));

    expect(indexSession).toHaveBeenCalledTimes(2);
    expect(indexSession).toHaveBeenNthCalledWith(1, "session-1");
    expect(indexSession).toHaveBeenNthCalledWith(2, "session-1");
    expect(events.some((event) => event.type === "state" && event.state === "error")).toBe(false);
    await runtime.handleRequest({ id: "dispose", type: "dispose" });
    await rm(directory, { recursive: true, force: true });
  });
});
