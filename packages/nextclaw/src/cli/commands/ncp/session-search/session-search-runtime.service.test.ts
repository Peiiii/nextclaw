import { describe, expect, it, vi } from "vitest";
import type { NcpTool } from "@nextclaw/ncp";
import { SessionSearchUnsupportedRuntimeError } from "./session-search-store.service.js";
import { SessionSearchRuntimeSupport } from "./session-search-runtime.service.js";

type FakeFeature = {
  initialize: () => Promise<void>;
  createTool: () => NcpTool;
  handleSessionUpdated: (sessionKey: string) => Promise<void>;
  dispose: () => Promise<void>;
};

function createFakeTool(): NcpTool {
  return {
    name: "session_search",
    description: "fake",
    parameters: {
      type: "object",
      properties: {},
    },
    execute: async () => ({ totalHits: 0, hits: [] }),
  };
}

describe("SessionSearchRuntimeSupport", () => {
  it("does not expose session_search before warmup finishes", () => {
    const support = new SessionSearchRuntimeSupport({
      sessionManager: {} as never,
      databasePath: "/tmp/session-search.db",
      onSessionUpdated: vi.fn(),
      feature: {
        initialize: async () => undefined,
        createTool: () => createFakeTool(),
        handleSessionUpdated: async () => undefined,
        dispose: async () => undefined,
      },
    });

    expect(support.createAdditionalTools({ currentSessionId: "session-1" })).toEqual([]);
    expect(support.isReady()).toBe(false);
  });

  it("disables session_search when node:sqlite is unavailable", async () => {
    const onSessionUpdated = vi.fn();
    const feature: FakeFeature = {
      initialize: async () => {
        throw new SessionSearchUnsupportedRuntimeError("node:sqlite unavailable");
      },
      createTool: () => createFakeTool(),
      handleSessionUpdated: async () => undefined,
      dispose: async () => undefined,
    };

    const support = new SessionSearchRuntimeSupport({
      sessionManager: {} as never,
      databasePath: "/tmp/session-search.db",
      onSessionUpdated,
      feature,
    });

    await expect(support.initialize()).resolves.toBeUndefined();
    expect(support.createAdditionalTools({ currentSessionId: "session-1" })).toEqual([]);
    expect(support.isReady()).toBe(false);

    support.handleSessionUpdated("session-2");
    expect(onSessionUpdated).toHaveBeenCalledWith("session-2");
  });

  it("exposes session_search only after initialization completes", async () => {
    const support = new SessionSearchRuntimeSupport({
      sessionManager: {} as never,
      databasePath: "/tmp/session-search.db",
      feature: {
        initialize: async () => undefined,
        createTool: () => createFakeTool(),
        handleSessionUpdated: async () => undefined,
        dispose: async () => undefined,
      },
    });

    await support.initialize();

    expect(support.isReady()).toBe(true);
    expect(support.createAdditionalTools({ currentSessionId: "session-1" })).toHaveLength(1);
  });
});
