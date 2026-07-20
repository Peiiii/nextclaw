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
