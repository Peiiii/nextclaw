import { describe, expect, it, vi } from "vitest";
import { NextClawClient } from "../nextclaw-client.manager.js";

describe("ProjectsService", () => {
  it("observes a registered project through the projects namespace", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      data: { asOf: "2026-08-30T00:00:00.000Z", dataQuality: "complete" },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const client = new NextClawClient({ baseUrl: "http://127.0.0.1:55667", fetchImpl });

    await expect(client.projects.getObservation("project-123")).resolves.toMatchObject({
      dataQuality: "complete",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:55667/api/projects/project-123/observation",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("normalizes older observation snapshots while a server is being upgraded", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      data: {
        asOf: "2026-08-30T00:00:00.000Z",
        dataQuality: "complete",
        workItems: [{
          id: "legacy-item",
          title: "Legacy item title",
          status: "active",
          updatedAt: "2026-08-30T00:00:00.000Z",
          reference: { kind: "ai-report", label: "AI", observedAt: "2026-08-30T00:00:00.000Z" },
        }],
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const client = new NextClawClient({ baseUrl: "http://127.0.0.1:55667", fetchImpl });

    await expect(client.projects.getObservation("project-legacy")).resolves.toMatchObject({
      runs: [],
      workItems: [expect.objectContaining({ id: "legacy-item", name: "Legacy item title" })],
    });
  });
});
