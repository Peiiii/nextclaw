import { describe, expect, it, vi } from "vitest";
import { SessionsUpdateTool } from "@kernel/tools/session-update.tools.js";

describe("SessionsUpdateTool", () => {
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
