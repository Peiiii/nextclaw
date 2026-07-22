import { describe, expect, it, vi } from "vitest";
import { SessionsService } from "./sessions.service.js";

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
    const service = new SessionsService(
      { get, delete: remove } as never,
      { subscribeAll: vi.fn() } as never,
    );

    await service.listQueuedInputs("session / 1");
    await service.deleteQueuedInput("session / 1", "queued / 1");

    expect(get).toHaveBeenCalledWith(
      "/api/ncp/sessions/session%20%2F%201/queued-inputs",
    );
    expect(remove).toHaveBeenCalledWith(
      "/api/ncp/sessions/session%20%2F%201/queued-inputs/queued%20%2F%201",
    );
  });
});
