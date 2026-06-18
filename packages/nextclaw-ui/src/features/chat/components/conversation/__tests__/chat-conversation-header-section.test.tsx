import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PersistStorage, StorageValue } from "zustand/middleware";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatConversationHeaderSection } from "@/features/chat/components/conversation/chat-conversation-header-section";
import { useChatQueryStore } from "@/features/chat/stores/ncp-chat-query.store";
import { useChatSessionListStore } from "@/features/chat/stores/chat-session-list.store";
import { useChatThreadStore } from "@/features/chat/stores/chat-thread.store";
import type { NcpSessionSummaryView } from "@/shared/lib/api";

const mocks = vi.hoisted(() => ({
  deleteSession: vi.fn(),
  openChildSessionPanel: vi.fn(),
  openSessionCronPanel: vi.fn(),
}));

vi.mock("@/features/chat/components/providers/chat-presenter.provider", () => ({
  usePresenter: () => ({
    chatThreadManager: {
      deleteSession: mocks.deleteSession,
      openChildSessionPanel: mocks.openChildSessionPanel,
      openSessionCronPanel: mocks.openSessionCronPanel,
    },
  }),
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
    updatedAt: "2026-06-18T00:00:00.000Z",
    ...overrides,
  };
}

function renderHeaderSection() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ChatConversationHeaderSection layoutMode="desktop" />
    </QueryClientProvider>,
  );
}

describe("ChatConversationHeaderSection", () => {
  beforeEach(() => {
    mocks.deleteSession.mockReset();
    mocks.openChildSessionPanel.mockReset();
    mocks.openSessionCronPanel.mockReset();
    useChatSessionListStore.persist.setOptions({
      storage: new MemoryPersistStorage(),
    });
    useChatThreadStore.persist.setOptions({
      storage: new MemoryPersistStorage(),
    });
    useChatSessionListStore.setState({
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        selectedAgentId: "main",
        selectedSessionKey: "parent-session-1",
      },
    });
    useChatThreadStore.setState({
      snapshot: {
        ...useChatThreadStore.getState().snapshot,
        sessionKey: "parent-session-1",
        childSessionTabs: [],
        workspaceFileTabs: [],
        workspacePanelParentKey: null,
        activeWorkspacePanelKind: null,
      },
    });
    useChatQueryStore.setState({
      snapshot: {
        sessionsQuery: {
          data: {
            sessions: [
              createSummary({
                sessionId: "parent-session-1",
                metadata: {
                  label: "Parent Task",
                  session_type: "native",
                },
              }),
              createSummary({
                sessionId: "child-session-1",
                agentId: "verifier",
                metadata: {
                  label: "Child Task",
                  parent_session_id: "parent-session-1",
                  session_type: "native",
                },
              }),
            ],
            total: 2,
          },
        } as never,
        sessionTypesQuery: {
          data: {
            defaultType: "native",
            options: [],
          },
        } as never,
      },
    });
  });

  it("shows the child-session entry from session query state before a tool card opens it", async () => {
    const user = userEvent.setup();

    renderHeaderSection();
    await user.click(screen.getByRole("button", { name: "View child sessions" }));

    expect(mocks.openChildSessionPanel).toHaveBeenCalledWith({
      parentSessionKey: "parent-session-1",
      activeChildSessionKey: "child-session-1",
    });
  });
});
