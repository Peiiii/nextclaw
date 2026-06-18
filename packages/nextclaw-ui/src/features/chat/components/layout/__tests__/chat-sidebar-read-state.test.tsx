import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatSidebar } from "@/features/chat/components/layout/chat-sidebar";
import type { NcpSessionListItemView } from "@/features/chat/features/ncp/hooks/use-ncp-session-list-view";
import { useChatQueryStore } from "@/features/chat/stores/ncp-chat-query.store";
import { useChatSessionListStore } from "@/features/chat/stores/chat-session-list.store";
import { viewportLayoutManager } from "@/app/managers/viewport-layout.manager";

const mocks = vi.hoisted(() => ({
  sessionItems: [] as NcpSessionListItemView[],
}));

vi.mock("@/features/chat/components/providers/chat-presenter.provider", () => ({
  usePresenter: () => ({
    chatUiManager: {
      goToSession: vi.fn(),
      goToChatRoot: vi.fn(),
    },
    chatSessionListManager: {
      createSession: vi.fn(),
      setQuery: vi.fn(),
      setListMode: vi.fn(),
      selectSession: vi.fn(),
      markSessionRead: (
        sessionKey: string | null | undefined,
        readAt: string | null | undefined,
      ) =>
        sessionKey
          ? useChatSessionListStore
              .getState()
              .markSessionRead(sessionKey, readAt)
          : undefined,
    },
    chatThreadManager: {
      openChildSessionPanel: vi.fn(),
    },
  }),
}));

vi.mock("@/features/chat/features/ncp/hooks/use-ncp-session-list-view", () => ({
  useNcpSessionListView: () => ({
    isLoading: false,
    items: mocks.sessionItems,
  }),
}));

vi.mock(
  "@/features/chat/features/session/hooks/use-chat-sidebar-session-label-editor",
  () => ({
    useChatSidebarSessionLabelEditor: () => ({
      editingSessionKey: null,
      draftLabel: "",
      savingSessionKey: null,
      setDraftLabel: vi.fn(),
      startEditingSessionLabel: vi.fn(),
      cancelEditingSessionLabel: vi.fn(),
      saveSessionLabel: vi.fn(),
    }),
  }),
);

vi.mock("@/shared/hooks/use-agents", () => ({
  useAgents: () => ({ data: { agents: [] } }),
}));

vi.mock("@/features/system-status", () => ({
  useSystemStatus: () => ({ connectionStatus: "connected" }),
}));

vi.mock("@/shared/components/doc-browser", () => ({
  useDocBrowser: () => ({ open: vi.fn() }),
}));

vi.mock("@/shared/components/common/brand-header", () => ({
  BrandHeader: () => <div data-testid="brand-header" />,
}));

vi.mock("@/shared/components/common/status-badge", () => ({
  StatusBadge: () => <div data-testid="status-badge" />,
}));

vi.mock("@/app/components/i18n-provider", () => ({
  useI18n: () => ({ language: "en", setLanguage: vi.fn() }),
}));

vi.mock("@/app/components/theme-provider", () => ({
  useTheme: () => ({ theme: "warm", setTheme: vi.fn() }),
}));

function createRunningSessionItem(
  runStatus?: NcpSessionListItemView["runStatus"],
): NcpSessionListItemView {
  return {
    runStatus,
    session: {
      key: "session:ncp-running",
      createdAt: "2026-03-19T09:00:00.000Z",
      updatedAt: "2026-03-19T09:05:00.000Z",
      lastMessageAt: "2026-03-19T09:05:00.000Z",
      readAt: "2026-03-19T09:04:00.000Z",
      label: "Running Task",
      sessionType: "native",
      sessionTypeMutable: false,
      messageCount: 2,
    },
  };
}

function resetReadStateTestState() {
  window.localStorage.clear();
  viewportLayoutManager.resetForTests();
  mocks.sessionItems = [];
  useChatQueryStore.setState({
    snapshot: {
      ...useChatQueryStore.getState().snapshot,
      sessionTypesQuery: {
        data: {
          defaultType: "native",
          options: [{ value: "native", label: "Native", ready: true }],
        },
      } as never,
    },
  });
  useChatSessionListStore.setState({
    optimisticReadAtBySessionKey: {},
    snapshot: {
      ...useChatSessionListStore.getState().snapshot,
      query: "",
      listMode: "time-first",
      selectedSessionKey: "session:ncp-running",
    },
  });
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function createReadStateSidebarElement(queryClient: QueryClient) {
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ChatSidebar />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function renderReadStateSidebar(queryClient: QueryClient) {
  return render(createReadStateSidebarElement(queryClient));
}

describe("ChatSidebar read state sync", () => {
  beforeEach(resetReadStateTestState);

  it("waits until the active running session is idle before persisting the read watermark", async () => {
    mocks.sessionItems = [createRunningSessionItem("running")];
    const queryClient = createTestQueryClient();
    const { rerender } = renderReadStateSidebar(queryClient);

    await waitFor(() => {
      expect(
        useChatSessionListStore.getState().optimisticReadAtBySessionKey[
          "session:ncp-running"
        ],
      ).toBeUndefined();
    });

    mocks.sessionItems = [createRunningSessionItem()];
    rerender(createReadStateSidebarElement(queryClient));

    await waitFor(() => {
      expect(
        useChatSessionListStore.getState().optimisticReadAtBySessionKey[
          "session:ncp-running"
        ],
      ).toBe("2026-03-19T09:05:00.000Z");
    });
  });

  it("collapses the desktop sidebar into accessible icon actions", () => {
    const { container } = renderReadStateSidebar(createTestQueryClient());

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    const persistedState = JSON.parse(
      window.localStorage.getItem("nextclaw.app.viewport-layout") ?? "{}",
    ) as { state?: { isSidebarCollapsed?: boolean } };

    expect(
      container.querySelector("aside")?.getAttribute("data-sidebar-collapsed"),
    ).toBe("true");
    expect(persistedState.state?.isSidebarCollapsed).toBe(true);
    expect(screen.getByRole("button", { name: "New Task" }).textContent).toBe(
      "",
    );
    expect(screen.queryByPlaceholderText("Search conversations...")).toBeNull();
    expect(screen.getByRole("link", { name: "Scheduled Tasks" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Settings menu" })).toBeTruthy();
  });
});
