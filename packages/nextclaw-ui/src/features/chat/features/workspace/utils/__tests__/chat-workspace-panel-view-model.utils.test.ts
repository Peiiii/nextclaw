import { describe, expect, it, vi } from "vitest";
import type { ResolvedChildSessionTab } from "@/features/chat/features/ncp/hooks/use-ncp-child-session-tabs-view";
import {
  buildWorkspaceTabsViewModel,
  resolveWorkspaceSelection,
} from "@/features/chat/features/workspace/utils/chat-workspace-panel-view-model.utils";

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
        activeSideChatDraft: null,
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
        activeSideChatDraft: null,
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

  it("honors the explicit side chat draft selection", () => {
    const draft = {
      draftKey: "draft-1",
      parentSessionKey: "parent-1",
    };

    expect(
      resolveWorkspaceSelection({
        activePanelKind: "side-chat-draft",
        activeChildSessionKey: null,
        activeSideChatDraft: draft,
        activeWorkspaceFileKey: null,
        childSessionTabs: [createChildTab()],
        workspaceFileTabs: [],
        sessionCronJobCount: 0,
      }),
    ).toMatchObject({
      kind: "side-chat-draft",
      draft,
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
      activeSideChatDraft: null,
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

  it("places the side chat draft tab before child session tabs", () => {
    const draft = {
      draftKey: "draft-1",
      parentSessionKey: "parent-1",
    };
    const childTab = createChildTab();

    const tabs = buildWorkspaceTabsViewModel({
      resolvedChildTabs: [childTab],
      activeSideChatDraft: draft,
      workspaceFileTabs: [],
      sessionCronJobCount: 0,
      activeSelection: {
        kind: "side-chat-draft",
        draft,
      },
      optimisticReadAtBySessionKey: {},
      onSelectSession: vi.fn(),
      onSelectFile: vi.fn(),
      onCloseFile: vi.fn(),
      onSelectCronJobs: vi.fn(),
    });

    expect(tabs.map((tab) => tab.key)).toEqual([
      "side-chat-draft:draft-1",
      "child:child-1",
    ]);
    expect(tabs[0]).toMatchObject({
      kind: "side-chat-draft",
      active: true,
    });
  });

  it("keeps distinct source and rendered file tabs without collapsing by path", () => {
    const renderedTab = {
      key: "parent::preview:rendered::demo.html",
      parentSessionKey: "parent-1",
      path: "demo.html",
      label: "demo.html",
      viewMode: "preview" as const,
      previewViewer: "rendered" as const,
    };
    const sourceTab = {
      key: "parent::preview::demo.html",
      parentSessionKey: "parent-1",
      path: "demo.html",
      label: "demo.html",
      viewMode: "preview" as const,
      previewViewer: "source" as const,
    };

    const tabs = buildWorkspaceTabsViewModel({
      resolvedChildTabs: [],
      activeSideChatDraft: null,
      workspaceFileTabs: [sourceTab, renderedTab],
      sessionCronJobCount: 0,
      activeSelection: {
        kind: "file",
        file: sourceTab,
      },
      optimisticReadAtBySessionKey: {},
      onSelectSession: vi.fn(),
      onSelectFile: vi.fn(),
      onCloseFile: vi.fn(),
      onSelectCronJobs: vi.fn(),
    });

    expect(tabs).toEqual([
      expect.objectContaining({
        key: "file:parent::preview::demo.html",
        active: true,
      }),
      expect.objectContaining({
        key: "file:parent::preview:rendered::demo.html",
        active: false,
      }),
    ]);
  });
});
