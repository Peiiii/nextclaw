import { describe, expect, it, vi } from "vitest";
import type { ResolvedChildSessionTab } from "@/features/chat/hooks/use-ncp-child-session-tabs-view";
import {
  buildWorkspaceTabsViewModel,
  resolveWorkspaceSelection,
} from "../chat-workspace-panel-view-model.utils";

function createChildTab(
  overrides: Partial<ResolvedChildSessionTab> = {},
): ResolvedChildSessionTab {
  return {
    sessionKey: "child-1",
    parentSessionKey: "parent-1",
    title: "Child session",
    agentId: "agent-1",
    updatedAt: null,
    lastMessageAt: null,
    readAt: null,
    runStatus: undefined,
    sessionTypeLabel: null,
    preferredModel: null,
    projectName: null,
    projectRoot: null,
    ...overrides,
  };
}

describe("resolveWorkspaceSelection", () => {
  it("honors the explicit active panel kind before fallback order", () => {
    const childTab = createChildTab();
    const fileTab = {
      key: "file-1",
      parentSessionKey: "parent-1",
      path: "docs/example.md",
      viewMode: "preview" as const,
    };

    expect(
      resolveWorkspaceSelection({
        activePanelKind: "file",
        activeChildSessionKey: childTab.sessionKey,
        activeWorkspaceFileKey: fileTab.key,
        childSessionTabs: [childTab],
        workspaceFileTabs: [fileTab],
        sessionCronJobCount: 1,
      }),
    ).toMatchObject({
      kind: "file",
      file: fileTab,
    });
  });

  it("falls back to the first available child session", () => {
    const childTab = createChildTab({ sessionKey: "fallback-child" });

    expect(
      resolveWorkspaceSelection({
        activePanelKind: null,
        activeChildSessionKey: null,
        activeWorkspaceFileKey: null,
        childSessionTabs: [childTab],
        workspaceFileTabs: [],
        sessionCronJobCount: 1,
      }),
    ).toMatchObject({
      kind: "child-session",
      tab: childTab,
    });
  });
});

describe("buildWorkspaceTabsViewModel", () => {
  it("builds active and unread state from resolved tabs", () => {
    const childTab = createChildTab({
      lastMessageAt: "2026-06-09T10:00:00.000Z",
      readAt: "2026-06-09T09:00:00.000Z",
    });
    const onSelectSession = vi.fn();

    const tabs = buildWorkspaceTabsViewModel({
      resolvedChildTabs: [childTab],
      workspaceFileTabs: [],
      sessionCronJobCount: 0,
      activeSelection: null,
      optimisticReadAtBySessionKey: {},
      onSelectSession,
      onSelectFile: vi.fn(),
      onCloseFile: vi.fn(),
      onSelectCronJobs: vi.fn(),
    });

    expect(tabs[0]).toMatchObject({
      key: "child:child-1",
      kind: "child-session",
      title: "Child session",
      active: false,
      showUnreadDot: true,
    });

    tabs[0]?.onSelect();
    expect(onSelectSession).toHaveBeenCalledWith("child-1");
  });
});
