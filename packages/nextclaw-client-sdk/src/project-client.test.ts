import { expect, it, vi } from "vitest";
import { NextClawClient } from "./index.js";

it("lists registered projects from the project registry api", async () => {
  const fetchImpl = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            projects: [
              {
                name: "Knowledge",
                rootPath: "/tmp/knowledge",
                createdAt: "2026-07-15T00:00:00.000Z",
                updatedAt: "2026-07-15T00:00:00.000Z",
              },
            ],
            templates: [],
            total: 1,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  );
  const client = new NextClawClient({
    baseUrl: "http://127.0.0.1:55667",
    fetchImpl,
  });

  await expect(client.projects.list()).resolves.toMatchObject({ total: 1 });
  expect(fetchImpl).toHaveBeenCalledWith(
    "http://127.0.0.1:55667/api/projects",
    expect.objectContaining({ method: "GET" }),
  );
});

it("removes a project only through the explicit confirmation contract", async () => {
  const project = {
    id: "project-knowledge",
    name: "Knowledge",
    rootPath: "/tmp/knowledge",
    createdAt: "2026-07-15T00:00:00.000Z",
    updatedAt: "2026-07-15T00:00:00.000Z",
  };
  const fetchImpl = vi.fn(
    async () =>
      new Response(JSON.stringify({ ok: true, data: project }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  );
  const client = new NextClawClient({
    baseUrl: "http://127.0.0.1:55667",
    fetchImpl,
  });

  await expect(client.projects.remove(project.id, project.id)).resolves.toEqual(
    project,
  );
  expect(fetchImpl).toHaveBeenCalledWith(
    "http://127.0.0.1:55667/api/projects/project-knowledge",
    expect.objectContaining({
      method: "DELETE",
      body: JSON.stringify({ confirmProjectId: "project-knowledge" }),
    }),
  );
});
