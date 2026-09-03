import { describe, expect, it, vi } from "vitest";
import { ProjectWorkListTool } from "./project-work.tools.js";

describe("ProjectWorkListTool", () => {
  it("keeps agent reads bounded and forwards opaque pagination filters", async () => {
    const list = vi.fn(async () => ({
      items: [],
      nextCursor: "next",
      total: 42,
    }));
    const tool = new ProjectWorkListTool({ list } as never, {
      projectId: "project-1",
      sessionId: "session-1",
    });

    const result = JSON.parse(
      await tool.execute({
        state_id: "review",
        cursor: "page-2",
        limit: 20,
        include_deleted: true,
      }),
    );

    expect(list).toHaveBeenCalledWith("project-1", {
      stateId: "review",
      cursor: "page-2",
      limit: 20,
      includeDeleted: true,
    });
    expect(result).toMatchObject({ nextCursor: "next", total: 42 });
  });
});
