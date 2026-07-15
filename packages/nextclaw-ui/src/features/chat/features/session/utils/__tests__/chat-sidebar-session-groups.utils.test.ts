import { describe, expect, it } from "vitest";
import { groupSessionsByProject } from "@/features/chat/features/session/utils/chat-sidebar-session-groups.utils";

describe("groupSessionsByProject", () => {
  it("uses registered projects as the project-first baseline", () => {
    const groups = groupSessionsByProject([], new Set(), new Set(), [{
      name: "Knowledge",
      rootPath: "/tmp/knowledge",
      template: "knowledge-base",
      createdAt: "2026-07-15T00:00:00.000Z",
      updatedAt: "2026-07-15T00:00:00.000Z",
    }]);

    expect(groups).toEqual([{
      projectRoot: "/tmp/knowledge",
      projectName: "Knowledge",
      items: [],
      latestUpdatedAt: new Date("2026-07-15T00:00:00.000Z").getTime(),
      isPinned: false,
    }]);
  });
});
