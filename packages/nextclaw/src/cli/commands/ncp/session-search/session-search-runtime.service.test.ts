import { describe, expect, it, vi } from "vitest";
import { SessionSearchRuntimeSupport } from "./session-search-runtime.service.js";
import type { SessionSearchRequest, SessionSearchResult } from "./session-search.types.js";

type FakeWorkerController = {
  start: () => Promise<void>;
  query: (request: SessionSearchRequest) => Promise<SessionSearchResult>;
  notifySessionUpdated: (sessionId: string) => void;
  dispose: () => Promise<void>;
  getState: () => "stopped" | "starting" | "ready" | "indexing" | "idle" | "error" | "disposed";
};

function createFakeWorkerController(params: {
  start?: () => Promise<void>;
  state?: FakeWorkerController["getState"];
} = {}): FakeWorkerController {
  return {
    start: params.start ?? (async () => undefined),
    query: async () => ({ query: "test", totalHits: 0, hits: [] }),
    notifySessionUpdated: vi.fn<(sessionId: string) => void>(),
    dispose: async () => undefined,
    getState: params.state ?? (() => "ready"),
  };
}

describe("SessionSearchRuntimeSupport", () => {
  it("does not expose session_search before warmup finishes", () => {
    const workerController = createFakeWorkerController();
    const support = new SessionSearchRuntimeSupport({
      sessionManager: {} as never,
      databasePath: "/tmp/session-search.db",
      onSessionUpdated: vi.fn(),
      workerController,
    });

    expect(support.createAdditionalTools({ currentSessionId: "session-1" })).toEqual([]);
    expect(support.isReady()).toBe(false);
  });

  it("disables session_search when the worker cannot start", async () => {
    const onSessionUpdated = vi.fn();
    const workerController = createFakeWorkerController({
      start: async () => {
        throw new Error("node:sqlite unavailable");
      },
    });

    const support = new SessionSearchRuntimeSupport({
      sessionManager: {} as never,
      databasePath: "/tmp/session-search.db",
      onSessionUpdated,
      workerController,
    });

    await expect(support.initialize()).resolves.toBeUndefined();
    expect(support.createAdditionalTools({ currentSessionId: "session-1" })).toEqual([]);
    expect(support.isReady()).toBe(false);

    support.handleSessionUpdated("session-2");
    expect(onSessionUpdated).toHaveBeenCalledWith("session-2");
  });

  it("exposes session_search only after initialization completes", async () => {
    const workerController = createFakeWorkerController();
    const support = new SessionSearchRuntimeSupport({
      sessionManager: {} as never,
      databasePath: "/tmp/session-search.db",
      workerController,
    });

    await support.initialize();

    expect(support.isReady()).toBe(true);
    expect(support.createAdditionalTools({ currentSessionId: "session-1" })).toHaveLength(1);
  });

  it("forwards session updates to the worker after initialization", async () => {
    const onSessionUpdated = vi.fn();
    const workerController = createFakeWorkerController();
    const support = new SessionSearchRuntimeSupport({
      sessionManager: {} as never,
      databasePath: "/tmp/session-search.db",
      onSessionUpdated,
      workerController,
    });

    await support.initialize();
    support.handleSessionUpdated("session-2");

    expect(onSessionUpdated).toHaveBeenCalledWith("session-2");
    expect(workerController.notifySessionUpdated).toHaveBeenCalledWith("session-2");
  });
});
