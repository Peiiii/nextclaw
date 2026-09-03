import { describe, expect, it, vi } from "vitest";
import { EventBus } from "@nextclaw/shared";
import { ProjectObservationError } from "@nextclaw/kernel";
import { createUiRouter } from "@nextclaw-server/app/router.js";
import { createRouterTestKernel } from "@nextclaw-server/app/tests/router-test-kernel.js";

function createProjectsApp(projectManager: object, projectObservation?: object) {
  return createUiRouter({
    appEventBus: new EventBus(),
    configPath: "/tmp/nextclaw-project-routes-test-config.json",
    kernel: createRouterTestKernel({
      projectManager,
      ...(projectObservation ? { projectObservation } : {}),
    } as never),
  });
}

describe("projects routes", () => {
  it("mounts the independent project list through the assembled UI router", async () => {
    const listProjects = vi.fn(async () => [{
      id: "project-knowledge",
      name: "Knowledge",
      rootPath: "/tmp/knowledge",
      createdAt: "2026-07-15T00:00:00.000Z",
      updatedAt: "2026-07-15T00:00:00.000Z",
    },]);
    const app = createProjectsApp({
      listProjects,
      listTemplates: () => [{
        id: "knowledge-base",
        description: "Knowledge base",
      },],
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
      id: "project-knowledge",
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
    const addExistingProject = vi.fn(async (rootPath) => ({
      id: "project-existing",
      name: "existing",
      rootPath,
      createdAt: "2026-07-20T00:00:00.000Z",
      updatedAt: "2026-07-20T00:00:00.000Z",
    }));
    const app = createProjectsApp({
      addExistingProject,
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
    expect(addExistingProject).toHaveBeenCalledWith("/tmp/existing");
  });

  it("requires exact confirmation and removes through the kernel owner", async () => {
    const removed = {
      id: "project-knowledge",
      name: "Knowledge",
      rootPath: "/tmp/knowledge",
      createdAt: "2026-07-15T00:00:00.000Z",
      updatedAt: "2026-07-15T00:00:00.000Z",
    };
    const removeProject = vi.fn(async () => removed);
    const app = createProjectsApp({ removeProject });

    const invalid = await app.request("http://localhost/api/projects/project-knowledge", {
      method: "DELETE",
    });
    const response = await app.request("http://localhost/api/projects/project-knowledge", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmProjectId: "project-knowledge" }),
    });

    expect(invalid.status).toBe(400);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, data: removed });
    expect(removeProject).toHaveBeenCalledWith("project-knowledge", "project-knowledge");
  });

  it("observes a registered project through the kernel owner", async () => {
    const observe = vi.fn(async (rootPath: string) => ({
      asOf: "2026-08-30T00:00:00.000Z",
      project: { name: "Knowledge", rootPath, context: [] },
      sources: [], workflows: [], runs: [], workItems: [], artifacts: [], signals: [], requests: [],
      activity: [], skills: [], diagnostics: [], dataQuality: "complete",
    }));
    const getProjectById = vi.fn(async (projectId: string) =>
      projectId === "project-knowledge"
        ? { id: projectId, name: "Knowledge", rootPath: "/tmp/knowledge space", createdAt: "2026-08-30T00:00:00.000Z", updatedAt: "2026-08-30T00:00:00.000Z", }
        : null,
    );
    const app = createProjectsApp({ getProjectById }, { observe });
    const response = await app.request(
      "http://localhost/api/projects/project-knowledge/observation",
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, data: { dataQuality: "complete" }, });
    expect(getProjectById).toHaveBeenCalledWith("project-knowledge");
    expect(observe).toHaveBeenCalledWith("/tmp/knowledge space");
  });

  it("returns not found when the observation owner rejects an unregistered root", async () => {
    const observe = vi.fn(async () => {
      throw new ProjectObservationError("PROJECT_NOT_REGISTERED", "Project is not registered.");
    });
    const app = createProjectsApp({ getProjectById: async () => null }, { observe });

    const response = await app.request(
      "http://localhost/api/projects/project-missing/observation"
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "PROJECT_NOT_FOUND" },
    });
  });
});
