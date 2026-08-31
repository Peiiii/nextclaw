import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectCommands } from "./project-command.controller.js";

describe("ProjectCommands observe", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("uses the kernel observation owner and prints JSON", async () => {
    const snapshot = {
      asOf: "2026-08-30T00:00:00.000Z",
      project: { name: "Demo", rootPath: "/tmp/demo", context: [] },
      sources: [], workflows: [], workItems: [], artifacts: [], signals: [], requests: [],
      activity: [], skills: [], diagnostics: [], dataQuality: "complete",
    };
    const observe = vi.fn(async () => snapshot);
    const dispose = vi.fn(async () => undefined);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const commands = new ProjectCommands(() => ({ projectObservation: { observe }, dispose } as never));

    await commands.observe("/tmp/demo", { json: true });

    expect(observe).toHaveBeenCalledWith("/tmp/demo");
    expect(log).toHaveBeenCalledWith(JSON.stringify(snapshot, null, 2));
    expect(dispose).toHaveBeenCalledOnce();
  });
});
