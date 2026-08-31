import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectCommands } from "./project-command.controller.js";

describe("ProjectCommands observe", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("uses the kernel observation owner and prints JSON", async () => {
    const snapshot = {
      asOf: "2026-08-30T00:00:00.000Z",
      project: { name: "Demo", rootPath: "/tmp/demo", context: [] },
      sources: [],
      workflows: [],
      workItems: [],
      artifacts: [],
      signals: [],
      requests: [],
      activity: [],
      skills: [],
      diagnostics: [],
      dataQuality: "complete",
    };
    const observe = vi.fn(async () => snapshot);
    const dispose = vi.fn(async () => undefined);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const commands = new ProjectCommands(
      () => ({ projectObservation: { observe }, dispose }) as never,
    );

    await commands.observe("/tmp/demo", { json: true });

    expect(observe).toHaveBeenCalledWith("/tmp/demo");
    expect(log).toHaveBeenCalledWith(JSON.stringify(snapshot, null, 2));
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("routes work mutations through the running service with an explicit project id", async () => {
    const request = vi.fn(async () => ({
      id: "work-1",
      projectId: "project-1",
      title: "Updated",
      state: { name: "In Progress" },
      attention: "none",
    }));
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const commands = new ProjectCommands(
      () => {
        throw new Error("work commands must not create a kernel");
      },
      () => ({ request }) as never,
    );

    await commands.workUpdate("work-1", {
      project: "project-1",
      title: "Updated",
      version: "2",
    });

    expect(request).toHaveBeenCalledWith({
      path: "/api/projects/project-1/work/items/work-1",
      method: "PATCH",
      body: { title: "Updated", expectedVersion: 2 },
    });
    expect(log).toHaveBeenCalledWith(
      "Updated work item work-1\tIn Progress\tUpdated",
    );
  });
});
