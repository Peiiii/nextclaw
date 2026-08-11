import { describe, expect, it, vi } from "vitest";
import { buildWorkspaceEntryContextMenuGroups } from "@/features/chat/features/workspace/components/project-files/workspace-directory-entry-menu";
import type { ServerPathEntryView } from "@/shared/lib/api";

function buildMenu(entry: ServerPathEntryView) {
  return buildWorkspaceEntryContextMenuGroups({
    busy: false,
    downloadUrl: entry.kind === "file" ? "/download" : null,
    entry,
    onAddToChat: vi.fn(),
    onCreateFile: vi.fn(),
    onCreateFolder: vi.fn(),
    onDelete: vi.fn(),
    onOpen: vi.fn(),
    onRenameRequest: vi.fn(),
    onRevealPath: vi.fn(),
    onUpload: vi.fn(),
    ownCreateTarget: { label: entry.name, path: entry.path, refresh: vi.fn() },
    parentRefresh: vi.fn(),
    relativePath: entry.name,
  });
}

function visibleGroupKeys(entry: ServerPathEntryView) {
  return buildMenu(entry)
    .filter((group) => group.items.length > 0)
    .map((group) => group.key);
}

describe("workspace directory entry context menus", () => {
  it("keeps Open exclusive to files", () => {
    expect(
      visibleGroupKeys({
        name: "src",
        path: "/workspace/src",
        kind: "directory",
        hidden: false,
      }),
    ).toEqual(["nextclaw", "manage", "path", "rename", "danger"]);

    expect(
      visibleGroupKeys({
        name: "app.ts",
        path: "/workspace/app.ts",
        kind: "file",
        hidden: false,
      }),
    ).toEqual(["open", "nextclaw", "path", "rename", "danger"]);
  });
});
