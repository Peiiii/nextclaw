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

    support.handleSessionUpdated("session-2");
    expect(onSessionUpdated).toHaveBeenCalledWith("session-2");
  });
});
