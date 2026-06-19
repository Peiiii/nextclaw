import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PersistStorage, StorageValue } from "zustand/middleware";
import { ChatConversationWorkspaceSection } from "@/features/chat/components/conversation/chat-conversation-workspace-section";
import { useChatQueryStore } from "@/features/chat/stores/ncp-chat-query.store";
import { useChatThreadStore } from "@/features/chat/stores/chat-thread.store";
import type { NcpSessionSummaryView } from "@/shared/lib/api";

const mocks = vi.hoisted(() => ({
  panelProps: vi.fn(),
}));

vi.mock("@/features/chat/features/workspace/components/chat-session-workspace-panel", () => ({
  ChatSessionWorkspacePanel: ({
    sessionProjectRoot,
    sessionWorkingDir,
  }: {
    sessionProjectRoot: string | null;
    sessionWorkingDir: string | null;
  }) => {
    mocks.panelProps({ sessionProjectRoot, sessionWorkingDir });
    return (
      <div
        data-testid="workspace-panel"
        data-project-root={sessionProjectRoot ?? ""}
        data-working-dir={sessionWorkingDir ?? ""}
      />
    );
  },
}));

vi.mock("@/features/cron", () => ({
  useCronJobs: () => ({ data: { jobs: [] } }),
}));

class MemoryPersistStorage implements PersistStorage<unknown> {
  private readonly values = new Map<string, StorageValue<unknown>>();

  getItem = (name: string) => this.values.get(name) ?? null;

  setItem = (name: string, value: StorageValue<unknown>) => {
    this.values.set(name, value);
  };

  removeItem = (name: string) => {
    this.values.delete(name);
  };
}

function createSummary(
  overrides: Partial<NcpSessionSummaryView> & Pick<NcpSessionSummaryView, "sessionId">,
): NcpSessionSummaryView {
  return {
    messageCount: 1,
    status: "idle",
    updatedAt: "2026-06-19T00:00:00.000Z",
    ...overrides,
  };
}

describe("ChatConversationWorkspaceSection", () => {
  beforeEach(() => {
    mocks.panelProps.mockReset();
    useChatThreadStore.persist.setOptions({
      storage: new MemoryPersistStorage(),
    });
    useChatThreadStore.setState({
      snapshot: {
        ...useChatThreadStore.getState().snapshot,
        workspacePanelParentKey: "session-1",
        activeWorkspacePanelKind: "file",
        workspaceFileTabs: [
          {
            key: "file-tab",
            parentSessionKey: "session-1",
            path: "docs/designs/2026-06-10-core-kernel-responsibility.design.md",
            label: "core-kernel-responsibility",
            viewMode: "preview",
          },
        ],
        activeWorkspaceFileKey: "file-tab",
        childSessionTabs: [],
        activeChildSessionKey: null,
        workspaceNavigationHistory: [],
        workspaceNavigationHistoryIndex: 0,
        sessionProjectRoot: null,
        sessionWorkingDir: null,
      },
    });
    useChatQueryStore.setState({
      snapshot: {
        sessionsQuery: {
          data: {
            sessions: [
              createSummary({
                sessionId: "session-1",
                workingDir: "/Users/peiwang/Projects/nextbot",
                metadata: {
                  project_root: "/Users/peiwang/Projects/nextbot",
                },
              }),
            ],
            total: 1,
          },
        } as never,
      },
    });
  });

  it("uses selected session workingDir as the workspace file preview base path", () => {
    render(
      <ChatConversationWorkspaceSection
        layoutMode="desktop"
        sessionKey="session-1"
      />,
    );

    const panel = screen.getByTestId("workspace-panel");
    expect(panel.getAttribute("data-project-root")).toBe(
      "/Users/peiwang/Projects/nextbot",
    );
    expect(panel.getAttribute("data-working-dir")).toBe(
      "/Users/peiwang/Projects/nextbot",
    );
    expect(mocks.panelProps).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionProjectRoot: "/Users/peiwang/Projects/nextbot",
        sessionWorkingDir: "/Users/peiwang/Projects/nextbot",
      }),
    );
  });
});
