import { describe, expect, it, vi } from "vitest";
import { NextClawClient } from "../nextclaw-client.manager.js";

describe("ProjectsService", () => {
  it("reads project materials through bounded routes", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const data = String(url).endsWith("/agreement")
        ? { path: "AGENTS.md", available: true }
        : [
            {
              ref: "project:alpha",
              name: "alpha",
              path: ".agents/skills/alpha/SKILL.md",
            },
          ];
      return new Response(JSON.stringify({ ok: true, data }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const client = new NextClawClient({
      baseUrl: "http://127.0.0.1:55667",
      fetchImpl,
    });

    await expect(client.projects.getAgreement("project-123")).resolves.toEqual({
      path: "AGENTS.md",
      available: true,
    });
    await expect(
      client.projects.listProjectSkills("project-123"),
    ).resolves.toEqual([expect.objectContaining({ name: "alpha" })]);
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:55667/api/projects/project-123/agreement",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:55667/api/projects/project-123/skills",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("uses project-scoped work item routes for reads and mutations", async () => {
    const fetchImpl = vi.fn(
      async (url: string | URL | Request, init?: RequestInit) => {
        const data =
          init?.method === "PATCH"
            ? { id: "work-1", title: "Updated" }
            : { items: [], nextCursor: null, total: 0 };
        return new Response(JSON.stringify({ ok: true, data }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    );
    const client = new NextClawClient({
      baseUrl: "http://127.0.0.1:55667",
      fetchImpl,
    });

    await client.projects.listWork("project with space", {
      stateId: "in review",
      cursor: "next/page",
      limit: 20,
    });
    await client.projects.updateWorkItem("project with space", "work/1", {
      title: "Updated",
      expectedVersion: 2,
    });

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:55667/api/projects/project%20with%20space/work?stateId=in+review&cursor=next%2Fpage&limit=20",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:55667/api/projects/project%20with%20space/work/items/work%2F1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ title: "Updated", expectedVersion: 2 }),
      }),
    );
  });

  it("uses a separate bounded route for project work artifacts", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            data: { artifacts: [], nextCursor: null, total: 0 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    const client = new NextClawClient({
      baseUrl: "http://127.0.0.1:55667",
      fetchImpl,
    });

    await client.projects.listRecentWorkArtifacts("project-1", {
      limit: 5,
      query: "report",
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:55667/api/projects/project-1/work/artifacts?limit=5&query=report",
      expect.objectContaining({ method: "GET" }),
    );
  });
});
