import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextClawClientError } from "@nextclaw/client-sdk";
import { SessionMessageSourceManager } from "../session-message-source.manager";

const { read } = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/shared/lib/api/managers/client.manager", () => ({ nextclawClient: { sessions: { readMessagePart: read } } }));
beforeEach(() => read.mockReset());
const fragment = (content: string, nextCursor: string | null = null) => ({ content, nextCursor, revision: "r1" });
describe("bounded original source reader", () => {
  it("replaces the current fragment rather than accumulating an archived body", async () => {
    read.mockResolvedValueOnce(fragment("a".repeat(24 * 1024), "next")).mockResolvedValueOnce(fragment("second"));
    const manager = new SessionMessageSourceManager("s", "m", 1);
    await manager.read(); await manager.read();
    expect(read.mock.calls[1]?.slice(0, 4)).toEqual(["s", "m", 0, "next"]);
    expect(manager.getSnapshot()).toMatchObject({ content: "second", displayedPart: 0, hasMore: false });
    manager.dispose();
  });
  it("does not apply a cancelled response after selecting a different part", async () => {
    let resolve!: (value: ReturnType<typeof fragment>) => void;
    read.mockImplementationOnce(() => new Promise(value => { resolve = value; })).mockResolvedValueOnce(fragment("new part"));
    const manager = new SessionMessageSourceManager("s", "m", 2);
    const pending = manager.read(); manager.selectPart(1); await manager.read();
    resolve(fragment("obsolete response")); await pending;
    expect(manager.getSnapshot()).toMatchObject({ content: "new part", displayedPart: 1 });
    expect(read.mock.calls[0]?.[4].aborted).toBe(true); manager.dispose();
  });
  it("restarts the current part after an obsolete revision cursor is rejected", async () => {
    read.mockResolvedValueOnce(fragment("first", "obsolete")).mockRejectedValueOnce(new NextClawClientError({ code: "INVALID_CURSOR", message: "stale" }))
      .mockResolvedValueOnce({ ...fragment("new revision"), revision: "r2" });
    const manager = new SessionMessageSourceManager("s", "m", 1);
    await manager.read(); await manager.read(); expect(manager.getSnapshot().status).toBe("error");
    await manager.read(); expect(read.mock.calls[2]?.[3]).toBeUndefined();
    expect(manager.getSnapshot()).toMatchObject({ status: "ready", content: "new revision", revision: "r2" }); manager.dispose();
  });
});
