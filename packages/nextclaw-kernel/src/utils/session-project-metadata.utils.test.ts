import { describe, expect, it, vi } from "vitest";
import { applySessionProjectMetadataPatch } from "./session-manager.utils.js";

describe("applySessionProjectMetadataPatch", () => {
  it("persists the stable project id with the canonical root", async () => {
    const normalizeProjectContext = vi.fn(async () => ({
      projectId: "project-1",
      rootPath: "/tmp/project",
    }));

    await expect(
      applySessionProjectMetadataPatch(
        { label: "Research", project_root: "/tmp/old" },
        { projectRoot: "/tmp/project" },
        normalizeProjectContext,
      ),
    ).resolves.toEqual({
      label: "Research",
      project_id: "project-1",
      project_root: "/tmp/project",
    });
  });

  it("clears stable and legacy project metadata together", async () => {
    await expect(
      applySessionProjectMetadataPatch(
        {
          label: "Research",
          projectId: "legacy-id",
          projectRoot: "/tmp/legacy",
          project_id: "project-1",
          project_root: "/tmp/project",
        },
        { projectRoot: null },
        async () => null,
      ),
    ).resolves.toEqual({ label: "Research" });
  });
});
