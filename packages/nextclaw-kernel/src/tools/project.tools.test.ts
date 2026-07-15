import { describe, expect, it, vi } from "vitest";
import { ProjectsCreateTool, ProjectsListTool } from "@kernel/tools/project.tools.js";

describe("project tools", () => {
  it("lists registered projects and templates", async () => {
    const listProjects = vi.fn(async () => [{
      name: "Knowledge",
      rootPath: "/tmp/knowledge",
      createdAt: "2026-07-15T00:00:00.000Z",
      updatedAt: "2026-07-15T00:00:00.000Z",
    }]);
    const tool = new ProjectsListTool({
      listProjects,
      listTemplates: () => [{ id: "empty", name: "Empty", description: "Empty" }],
    } as never);

    const result = JSON.parse(await tool.execute()) as { total: number };

    expect(result.total).toBe(1);
    expect(listProjects).toHaveBeenCalledOnce();
  });

  it("creates projects through the project owner", async () => {
    const createProject = vi.fn(async (input) => ({
      ...input,
      rootPath: input.rootPath ?? "/tmp/knowledge",
      createdAt: "2026-07-15T00:00:00.000Z",
      updatedAt: "2026-07-15T00:00:00.000Z",
    }));
    const tool = new ProjectsCreateTool({ createProject } as never);

    await tool.execute({ name: "Knowledge", template: "knowledge-base" });

    expect(createProject).toHaveBeenCalledWith({
      name: "Knowledge",
      template: "knowledge-base",
    });
  });
});
