import { describe, expect, it, vi } from "vitest";
import { EventBus } from "@nextclaw/shared";
import { createUiRouter } from "@nextclaw-server/app/router.js";
import { createRouterTestKernel } from "@nextclaw-server/app/tests/router-test-kernel.js";

function createProjectsApp(projectManager: object) {
  return createUiRouter({
    appEventBus: new EventBus(),
    configPath: "/tmp/nextclaw-project-routes-test-config.json",
    kernel: createRouterTestKernel({ projectManager } as never),
  });
}

describe("projects routes", () => {
  it("mounts the independent project list through the assembled UI router", async () => {
    const listProjects = vi.fn(async () => [{
      name: "Knowledge",
      rootPath: "/tmp/knowledge",
      createdAt: "2026-07-15T00:00:00.000Z",
      updatedAt: "2026-07-15T00:00:00.000Z",
    }]);
    const app = createProjectsApp({
      listProjects,
      listTemplates: () => [{
        id: "knowledge-base",
        description: "Knowledge base",
      }],
    });

    const response = await app.request("http://localhost/api/projects");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        projects: [expect.objectContaining({ name: "Knowledge" })],
        templates: [{ id: "knowledge-base", description: "Knowledge base" }],
        total: 1,
      },
    });
    expect(listProjects).toHaveBeenCalledOnce();
  });

  it("mounts project creation and preserves the standard response wrapper", async () => {
    const createProject = vi.fn(async (input) => ({
      ...input,
      rootPath: "/tmp/knowledge",
      createdAt: "2026-07-15T00:00:00.000Z",
      updatedAt: "2026-07-15T00:00:00.000Z",
    }));
    const app = createProjectsApp({
      createProject,
      listProjects: async () => [],
      listTemplates: () => [],
    });

    const response = await app.request("http://localhost/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Knowledge", template: "knowledge-base" }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: { name: "Knowledge", template: "knowledge-base" },
    });
    expect(createProject).toHaveBeenCalledWith({
      name: "Knowledge",
      template: "knowledge-base",
    });
  });

  it("mounts existing-directory registration without a template payload", async () => {
    const registerExistingProject = vi.fn(async (rootPath) => ({
      name: "existing",
      rootPath,
      createdAt: "2026-07-20T00:00:00.000Z",
      updatedAt: "2026-07-20T00:00:00.000Z",
    }));
    const app = createProjectsApp({
      registerExistingProject,
      listProjects: async () => [],
      listTemplates: () => [],
    });

    const response = await app.request("http://localhost/api/projects/existing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rootPath: "/tmp/existing" }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: { name: "existing", rootPath: "/tmp/existing" },
    });
    expect(registerExistingProject).toHaveBeenCalledWith("/tmp/existing");
  });
});
