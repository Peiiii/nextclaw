import { describe, expect, it, vi } from "vitest";
import { SessionsUpdateTool } from "@kernel/tools/session-update.tools.js";

describe("SessionsUpdateTool", () => {
  it('accepts false as an explicit unpin and rejects invalid pin types', async () => {
    const patchSessionSettings = vi.fn(async () => ({ sessionId: 'session-1', metadata: { pinned: false } }));
    const tool = new SessionsUpdateTool({ patchSessionSettings } as never);
    await tool.execute({ sessionKey: 'session-1', pinned: false });
    expect(patchSessionSettings).toHaveBeenCalledExactlyOnceWith('session-1', { pinned: false });
    await expect(tool.execute({ sessionKey: 'session-1', pinned: 'false' })).rejects.toThrow('pinned must be a boolean');
  });
  it("updates session label and project through SessionManager", async () => {
    const patchSessionSettings = vi.fn(async () => ({ sessionId: "session-1" }));
    const tool = new SessionsUpdateTool({ patchSessionSettings } as never);

    await tool.execute({
      sessionKey: "session-1",
      label: "Research",
      projectRoot: "/tmp/research",
    });

    expect(patchSessionSettings).toHaveBeenCalledWith("session-1", {
      label: "Research",
      projectRoot: "/tmp/research",
    });
  });
});
