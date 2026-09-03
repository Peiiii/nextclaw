import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectCommands } from "./project-command.controller.js";

describe("ProjectCommands", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("requires an exact id confirmation before removing a project", async () => {
    const removeProject = vi.fn(async () => ({
      id: "project-1",
      name: "Research",
      rootPath: "/tmp/research",
    }));
    const dispose = vi.fn(async () => undefined);
    const commands = new ProjectCommands(
      () =>
        ({
          projectManager: {
            initialize: vi.fn(async () => undefined),
            removeProject,
          },
          dispose,
        }) as never,
    );

    await expect(
      commands.remove("project-1", { confirm: "wrong" }),
    ).rejects.toThrow("must exactly match");
    expect(removeProject).not.toHaveBeenCalled();

    await commands.remove("project-1", { confirm: "project-1" });
    expect(removeProject).toHaveBeenCalledWith("project-1", "project-1");
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

  it("forwards work list cursor filters and exposes the next cursor", async () => {
    const request = vi.fn(async () => ({
      items: [
        {
          id: "work-1",
          title: "Paged",
          state: { name: "In Review" },
          attention: "none",
        },
      ],
      nextCursor: "next-page",
      total: 21,
    }));
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const commands = new ProjectCommands(
      () => {
        throw new Error("work commands must not create a kernel");
      },
      () => ({ request }) as never,
    );

    await commands.workList({
      project: "project-1",
      state: "review",
      cursor: "cursor-1",
      limit: "20",
      includeDeleted: true,
    });

    expect(request).toHaveBeenCalledWith({
      path: "/api/projects/project-1/work?limit=20&includeDeleted=true&stateId=review&cursor=cursor-1",
      method: "GET",
    });
    expect(log).toHaveBeenLastCalledWith(
      "More work items available. Next cursor: next-page",
    );
  });
});
