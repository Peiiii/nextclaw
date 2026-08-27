import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionCommands } from "./session-command.controller.js";

const session = { sessionId: "session-1" };
const getSession = vi.fn();
const deleteSession = vi.fn();
const deleteSessionRun = vi.fn();
const dispose = vi.fn();
const kernel = {
  sessionManager: { getSession, deleteSession },
  sessionRunManager: { deleteSessionRun },
  dispose,
};

describe("SessionCommands", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    getSession.mockResolvedValue(session);
    deleteSession.mockResolvedValue(undefined);
    dispose.mockResolvedValue(undefined);
  });

  it("deletes a confirmed session through the kernel owner", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const commands = new SessionCommands(() => kernel as never);

    await commands.delete("session-1", { confirm: "session-1", json: true });

    expect(getSession).toHaveBeenCalledWith("session-1");
    expect(deleteSessionRun).toHaveBeenCalledWith("session-1");
    expect(deleteSession).toHaveBeenCalledWith("session-1");
    expect(log).toHaveBeenCalledWith(
      JSON.stringify({ deleted: true, sessionId: "session-1" }, null, 2),
    );
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("rejects a mismatched confirmation before opening the kernel", async () => {
    const createKernel = vi.fn(() => kernel as never);
    const commands = new SessionCommands(createKernel);

    await expect(
      commands.delete("session-1", { confirm: "session-2" }),
    ).rejects.toThrow("--confirm must exactly match the session id: session-1");

    expect(createKernel).not.toHaveBeenCalled();
  });
});
