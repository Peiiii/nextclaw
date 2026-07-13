import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PersistStorage, StorageValue } from "zustand/middleware";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatConversationHeaderSection } from "@/features/chat/components/conversation/chat-conversation-header-section";
import { useChatQueryStore } from "@/features/chat/stores/ncp-chat-query.store";
import { useChatSessionListStore } from "@/features/chat/stores/chat-session-list.store";
import { useChatThreadStore } from "@/features/chat/stores/chat-thread.store";
import { viewportLayoutManager } from "@/app/managers/viewport-layout.manager";
import type { NcpSessionListItemView } from "@/features/chat/features/ncp/hooks/use-ncp-session-list-view";
import type { NcpSessionSummaryView, SessionEntryView } from "@/shared/lib/api";

const mocks = vi.hoisted(() => ({
  deleteSession: vi.fn(),
  toggleWorkspacePanel: vi.fn(),
  selectSession: vi.fn(),
  sessionItems: [] as NcpSessionListItemView[],
  isSessionListLoading: false,
}));

vi.mock("@/features/chat/components/providers/chat-presenter.provider", () => ({
  usePresenter: () => ({
    chatThreadManager: {
      deleteSession: mocks.deleteSession,
      toggleWorkspacePanel: mocks.toggleWorkspacePanel,
    },
    chatSessionListManager: {
      selectSession: mocks.selectSession,
    },
  }),
}));

vi.mock("@/features/chat/features/ncp/hooks/use-ncp-session-list-view", () => ({
  useNcpSessionListView: (params?: { query?: string | null }) => {
    const query = params?.query?.trim().toLowerCase() ?? "";
    const items = query
      ? mocks.sessionItems.filter(({ session }) =>
          [
            session.key,
            session.label ?? "",
            session.projectRoot ?? "",
            session.projectName ?? "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(query),
        )
      : mocks.sessionItems;
    return {
      isLoading: mocks.isSessionListLoading,
      items,
    };
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
    updatedAt: "2026-06-18T00:00:00.000Z",
    ...overrides,
  };
}

function createSessionListItem(
  overrides: Partial<SessionEntryView> & Pick<SessionEntryView, "key">,
): NcpSessionListItemView {
  return {
    session: {
      createdAt: "2026-06-18T00:00:00.000Z",
      updatedAt: "2026-06-18T00:00:00.000Z",
      lastMessageAt: "2026-06-18T00:00:00.000Z",
      readAt: "2026-06-18T00:00:00.000Z",
      sessionType: "native",
      sessionTypeMutable: false,
      messageCount: 1,
      ...overrides,
    },
    runStatus: overrides.status === "running" ? "running" : undefined,
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
    mocks.toggleWorkspacePanel.mockReset();
    mocks.selectSession.mockReset();
    mocks.isSessionListLoading = false;
    viewportLayoutManager.resetForTests();
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
    mocks.sessionItems = [
      createSessionListItem({
        key: "parent-session-1",
        label: "Parent Task",
      }),
      createSessionListItem({
        key: "session:ncp-2",
        label: "Background Task",
        lastMessageAt: "2026-06-18T01:00:00.000Z",
        readAt: "2026-06-18T01:00:00.000Z",
      }),
    ];
  });

  it("opens the current session workspace overview from the header", async () => {
    const user = userEvent.setup();

    renderHeaderSection();
    await user.click(screen.getByRole("button", { name: "Open session workspace" }));

    expect(mocks.toggleWorkspacePanel).toHaveBeenCalledWith("parent-session-1");
  });

  it("shows the close workspace action while the current session panel is open", () => {
    useChatThreadStore.setState({
      snapshot: {
        ...useChatThreadStore.getState().snapshot,
        workspacePanelParentKey: "parent-session-1",
        activeWorkspacePanelKind: "overview",
      },
    });

    renderHeaderSection();

    expect(
      screen.getByRole("button", { name: "Close session workspace" }),
    ).toBeTruthy();
  });

  it("uses the collapsed desktop title as a session switcher", async () => {
    const user = userEvent.setup();
    viewportLayoutManager.setSidebarCollapsed(true);

    renderHeaderSection();

    await user.click(screen.getByRole("button", { name: /Switch session/ }));
    await user.click(screen.getByRole("button", { name: /Background Task/ }));

    expect(mocks.selectSession).toHaveBeenCalledWith("session:ncp-2");
  });

  it("keeps the desktop title plain while the sidebar is expanded", () => {
    renderHeaderSection();

    expect(screen.queryByRole("button", { name: /Switch session/ })).toBeNull();
    expect(screen.getByText("Parent Task")).toBeTruthy();
    expect(screen.queryByText("Native")).toBeNull();
  });

  it("keeps the runtime badge for a non-native session", () => {
    useChatQueryStore.setState({
      snapshot: {
        ...useChatQueryStore.getState().snapshot,
        sessionsQuery: {
          data: {
            sessions: [
              createSummary({
                sessionId: "parent-session-1",
                metadata: {
                  label: "Parent Task",
                  session_type: "codex",
                },
              }),
            ],
            total: 1,
          },
        } as never,
        sessionTypesQuery: {
          data: {
            defaultType: "native",
            options: [{ value: "codex", label: "Codex", ready: true }],
          },
        } as never,
      },
    });
    mocks.sessionItems = [
      createSessionListItem({
        key: "parent-session-1",
        label: "Parent Task",
        sessionType: "codex",
      }),
    ];

    renderHeaderSection();

    expect(screen.getByText("Codex")).toBeTruthy();
  });

  it("keeps session switching available from a collapsed new-session header", async () => {
    const user = userEvent.setup();
    viewportLayoutManager.setSidebarCollapsed(true);
    useChatSessionListStore.setState({
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        selectedSessionKey: null,
      },
    });
    useChatThreadStore.setState({
      snapshot: {
        ...useChatThreadStore.getState().snapshot,
        sessionKey: null,
      },
    });

    renderHeaderSection();

    await user.click(screen.getByRole("button", { name: /Switch session/ }));
    await user.click(screen.getByRole("button", { name: /Background Task/ }));

    expect(mocks.selectSession).toHaveBeenCalledWith("session:ncp-2");
  });

  it("filters the collapsed title switcher with a local search query", async () => {
    const user = userEvent.setup();
    viewportLayoutManager.setSidebarCollapsed(true);

    renderHeaderSection();

    await user.click(screen.getByRole("button", { name: /Switch session/ }));
    const searchInput = screen.getByRole("textbox", {
      name: "Search session key / label",
    });
    await user.type(searchInput, "Background");
    await user.click(screen.getByRole("button", { name: /Background Task/ }));

    expect(mocks.selectSession).toHaveBeenCalledWith("session:ncp-2");

    await user.click(screen.getByRole("button", { name: /Switch session/ }));
    await user.type(
      screen.getByRole("textbox", { name: "Search session key / label" }),
      "missing",
    );

    expect(screen.getByText("No matching sessions")).toBeTruthy();
  });
});
