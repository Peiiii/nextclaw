import { describe, expect, it, vi } from "vitest";
import { EventBus } from "@nextclaw/shared";
import { ProjectWorkError } from "@nextclaw/kernel";
import { createUiRouter } from "@nextclaw-server/app/router.js";
import { createRouterTestKernel } from "@nextclaw-server/app/tests/router-test-kernel.js";

function createApp(projectWorkManager: object) {
  return createUiRouter({
    appEventBus: new EventBus(),
    configPath: "/tmp/nextclaw-project-work-routes-test.json",
    kernel: createRouterTestKernel({ projectWorkManager } as never),
  });
}

describe("project work routes", () => {
  it("mounts list and create through the kernel owner", async () => {
    const list = vi.fn(async () => ({ items: [], states: [], total: 0 }));
    const create = vi.fn(async (_projectId, input) => ({
      id: "work-1",
      ...input,
    }));
    const app = createApp({ list, create });

    const listed = await app.request(
      "http://localhost/api/projects/project-1/work",
    );
    const created = await app.request(
      "http://localhost/api/projects/project-1/work/items",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Implement" }),
      },
    );

    expect(listed.status).toBe(200);
    expect(created.status).toBe(201);
    expect(list).toHaveBeenCalledWith("project-1", false);
    expect(create).toHaveBeenCalledWith(
      "project-1",
      { title: "Implement" },
      { kind: "user", id: "ui" },
    );
  });

  it("maps optimistic concurrency conflicts to HTTP 409", async () => {
    const update = vi.fn(async () => {
      throw new ProjectWorkError("PROJECT_WORK_VERSION_CONFLICT", "changed");
    });
    const app = createApp({ update });

    const response = await app.request(
      "http://localhost/api/projects/project-1/work/items/work-1",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Changed", expectedVersion: 1 }),
      },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "PROJECT_WORK_VERSION_CONFLICT" },
    });
  });

  it("records bridge writes as CLI activity", async () => {
    const create = vi.fn(async (_projectId, input) => ({
      id: "work-1",
      ...input,
    }));
    const app = createApp({ create });

    const response = await app.request(
      "http://localhost/api/projects/project-1/work/items",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-nextclaw-request-source": "cli",
        },
        body: JSON.stringify({ title: "From CLI" }),
      },
    );

    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledWith(
      "project-1",
      { title: "From CLI" },
      { kind: "cli", id: "nextclaw" },
    );
  });

  it("passes explicit state migration on delete", async () => {
    const deleteState = vi.fn(async () => undefined);
    const app = createApp({ deleteState });

    const response = await app.request(
      "http://localhost/api/projects/project-1/work/states/review",
      {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ migrateToStateId: "progress" }),
      },
    );

    expect(response.status).toBe(200);
    expect(deleteState).toHaveBeenCalledWith(
      "project-1",
      "review",
      "progress",
      { kind: "user", id: "ui" },
    );
  });
});
