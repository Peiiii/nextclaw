import { describe, expect, it, vi } from "vitest";
import { SessionsService } from "./sessions.service.js";

describe("SessionsService.listMessages", () => {
  it("opts into the compact payload only when requested", async () => {
    const get = vi.fn(async (
      _path: string,
      _options?: { query?: URLSearchParams },
    ) => ({ messages: [] }));
    const service = new SessionsService(
      { get } as never,
      { subscribeAll: vi.fn() } as never,
    );

    await service.listMessages("session / 1", {
      limit: 20,
      toolPayload: "summary",
      initialPayload: "compact",
    });

    expect(get).toHaveBeenCalledWith(
      "/api/ncp/sessions/session%20%2F%201/messages",
      { query: expect.any(URLSearchParams) },
    );
    expect(get.mock.calls[0]?.[1]?.query?.toString()).toBe(
      "limit=20&toolPayload=summary&initialPayload=compact",
    );
  });
});

describe("SessionsService.getUsage", () => {
  it("gets the encoded session usage resource", async () => {
    const get = vi.fn(async () => ({ sessionId: "session / 1", runCount: 0 }));
    const service = new SessionsService(
      { get } as never,
      { subscribeAll: vi.fn() } as never,
    );

    await expect(service.getUsage("session / 1")).resolves.toMatchObject({
      sessionId: "session / 1",
      runCount: 0,
    });
    expect(get).toHaveBeenCalledWith("/api/ncp/sessions/session%20%2F%201/usage");
  });
});

describe("SessionsService.compactContext", () => {
  it("posts to the encoded session context action", async () => {
    const post = vi.fn(async () => ({
      compacted: true as const,
      sessionId: "session / 1",
    }));
    const service = new SessionsService(
      { post } as never,
      { subscribeAll: vi.fn() } as never,
    );

    await expect(service.compactContext("session / 1")).resolves.toEqual({
      compacted: true,
      sessionId: "session / 1",
    });
    expect(post).toHaveBeenCalledWith(
      "/api/ncp/sessions/session%20%2F%201/context/compact",
    );
  });
});

describe("SessionsService queued inputs", () => {
  it("uses encoded session-scoped queue resources", async () => {
    const get = vi.fn(async () => ({ sessionId: "session / 1", inputs: [] }));
    const remove = vi.fn(async () => ({ id: "queued / 1" }));
    const post = vi.fn(async () => ({ id: "queued / 1", placement: "steering" }));
    const service = new SessionsService(
      { get, delete: remove, post } as never,
      { subscribeAll: vi.fn() } as never,
    );

    await service.listQueuedInputs("session / 1");
    await service.deleteQueuedInput("session / 1", "queued / 1");
    await service.listPendingInputs("session / 1");
    await service.steerQueuedInput("session / 1", "queued / 1");

    expect(get).toHaveBeenCalledWith(
      "/api/ncp/sessions/session%20%2F%201/queued-inputs",
    );
    expect(remove).toHaveBeenCalledWith(
      "/api/ncp/sessions/session%20%2F%201/queued-inputs/queued%20%2F%201",
    );
    expect(get).toHaveBeenCalledWith(
      "/api/ncp/sessions/session%20%2F%201/pending-inputs",
    );
    expect(post).toHaveBeenCalledWith(
      "/api/ncp/sessions/session%20%2F%201/queued-inputs/queued%20%2F%201/steer",
    );
  });
});
