import { describe, expect, it, vi } from "vitest";
import { NextClawClient } from "../nextclaw-client.manager.js";

describe("ProjectsService", () => {
  it("observes a registered project through the projects namespace", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            data: { asOf: "2026-08-30T00:00:00.000Z", dataQuality: "complete" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    const client = new NextClawClient({
      baseUrl: "http://127.0.0.1:55667",
      fetchImpl,
    });

    await expect(
      client.projects.getObservation("project-123"),
    ).resolves.toMatchObject({
      dataQuality: "complete",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:55667/api/projects/project-123/observation",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("normalizes older observation snapshots while a server is being upgraded", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              asOf: "2026-08-30T00:00:00.000Z",
              dataQuality: "complete",
              workItems: [
                {
                  id: "legacy-item",
                  title: "Legacy item title",
                  status: "active",
                  updatedAt: "2026-08-30T00:00:00.000Z",
                  reference: {
                    kind: "ai-report",
                    label: "AI",
                    observedAt: "2026-08-30T00:00:00.000Z",
                  },
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    const client = new NextClawClient({
      baseUrl: "http://127.0.0.1:55667",
      fetchImpl,
    });

    await expect(
      client.projects.getObservation("project-legacy"),
    ).resolves.toMatchObject({
      runs: [],
      workItems: [
        expect.objectContaining({
          id: "legacy-item",
          name: "Legacy item title",
        }),
      ],
    });
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

  it("uses a separate bounded route for recent work artifacts", async () => {
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

    await client.projects.listRecentWorkArtifacts("project-1", { limit: 5 });

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:55667/api/projects/project-1/work/artifacts?limit=5",
      expect.objectContaining({ method: "GET" }),
    );
  });
});
