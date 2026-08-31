import { describe, expect, it, vi } from "vitest";
import { ProjectToolProvider } from "./project-tool.provider.js";

describe("ProjectToolProvider", () => {
  it("exposes project work tools only for a project-bound session", async () => {
    const getProjectById = vi.fn(async (id: string) => ({
      id,
      name: "Demo",
      rootPath: "/tmp/demo",
    }));
    const provider = new ProjectToolProvider(
      {
        resolve: async () => ({
          sessionId: "session-1",
          session: {
            sessionId: "session-1",
            agentId: "main",
            metadata: { project_id: "project-1", project_root: "/tmp/demo" },
          },
        }),
      } as never,
      { getProjectById } as never,
      {} as never,
    );

    const tools = await provider.provide({ message: {} } as never);

    expect(tools.map((tool) => tool.name)).toEqual([
      "projects_list",
      "projects_create",
      "project_work_list",
      "project_work_get",
      "project_work_create",
      "project_work_update",
    ]);
    expect(
      tools.find((tool) => tool.name === "project_work_update")?.parameters,
    ).toMatchObject({
      properties: {
        state_id: { type: "string" },
        deleted: { type: "boolean" },
      },
    });
  });

  it("keeps project work tools absent from projectless sessions", async () => {
    const provider = new ProjectToolProvider(
      {
        resolve: async () => ({
          sessionId: "session-1",
          session: { metadata: {} },
        }),
      } as never,
      {} as never,
      {} as never,
    );

    const tools = await provider.provide({ message: {} } as never);

    expect(tools.map((tool) => tool.name)).toEqual([
      "projects_list",
      "projects_create",
    ]);
  });
});
