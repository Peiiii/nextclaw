import { describe, expect, it, vi } from "vitest";
import { SessionSearchService } from "./session-search.service.js";

describe("SessionSearchService readiness", () => {
  it("reports indexing immediately and searches normally after startup", async () => {
    let complete!: () => void;
    let state: "starting" | "ready" = "starting";
    const query = vi.fn(async () => ({ query: "topic", totalHits: 0, hits: [] }));
    const service = new SessionSearchService({
      databasePath: "unused", sessionsDir: "unused",
      workerController: {
        start: () => new Promise<void>((resolve) => { complete = resolve; }),
        query, notifySessionUpdated: vi.fn(), dispose: vi.fn(), getState: () => state,
      },
    });
    const startup = service.start();
    await expect(service.search({ query: "topic" })).rejects.toThrow("SESSION_SEARCH_NOT_READY");
    expect(query).not.toHaveBeenCalled();
    state = "ready";
    complete();
    await startup;
    await expect(service.search({ query: "topic" })).resolves.toMatchObject({ totalHits: 0 });
    expect(query).toHaveBeenCalledOnce();
  });

  it("does not disguise a failed index as empty search results", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const query = vi.fn();
    const service = new SessionSearchService({
      databasePath: "unused", sessionsDir: "unused",
      workerController: {
        start: async () => { throw new Error("index failure"); }, query,
        notifySessionUpdated: vi.fn(), dispose: vi.fn(), getState: () => "error",
      },
    });
    try {
      await service.start();
      await expect(service.search({ query: "topic" })).rejects.toThrow("SESSION_SEARCH_UNAVAILABLE");
      expect(query).not.toHaveBeenCalled();
    } finally { warning.mockRestore(); }
  });
});
