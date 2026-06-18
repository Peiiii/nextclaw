import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatSidebar } from "@/features/chat/components/layout/chat-sidebar";
import type { NcpSessionListItemView } from "@/features/chat/features/ncp/hooks/use-ncp-session-list-view";
import { useChatQueryStore } from "@/features/chat/stores/ncp-chat-query.store";
import { useChatSessionListStore } from "@/features/chat/stores/chat-session-list.store";
import { PREFERENCE_KEYS } from "@/shared/lib/api";
import type { ChatSessionTypeOptionView } from "@/shared/lib/api";
import { viewportLayoutManager } from "@/app/managers/viewport-layout.manager";
const mocks = vi.hoisted(() => ({
  createSession: vi.fn(() => "draft-session-key"),
  goToSession: vi.fn(),
  goToChatRoot: vi.fn(),
  setQuery: vi.fn(),
  setListMode: vi.fn(),
  selectSession: vi.fn(),
  openChildSessionPanel: vi.fn(),
  docOpen: vi.fn(),
  setLanguage: vi.fn(),
  setTheme: vi.fn(),
  fetchPreference: vi.fn(),
  updatePreference: vi.fn(),
  updateNcpSession: vi.fn(),
  agents: [] as Array<{
    id: string;
    displayName?: string;
    avatarUrl?: string | null;
  }>,
  sessionItems: [] as NcpSessionListItemView[],
  isLoading: false,
}));
vi.mock("@/shared/lib/api", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    fetchPreference: mocks.fetchPreference,
    updatePreference: mocks.updatePreference,
  };
});
function createSessionItem(
  session: NcpSessionListItemView["session"],
  runStatus?: NcpSessionListItemView["runStatus"],
): NcpSessionListItemView {
  return { session, runStatus };
}
function setSessionTypes(
  options: ChatSessionTypeOptionView[],
  defaultType = "native",
) {
  useChatQueryStore.setState({
    snapshot: {
      ...useChatQueryStore.getState().snapshot,
      sessionTypesQuery: {
        data: {
          defaultType,
          options,
        },
      } as never,
    },
  });
}
function sidebarElement(variant?: "desktop" | "mobile") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ChatSidebar variant={variant} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}
function renderSidebar(variant?: "desktop" | "mobile") {
  return render(sidebarElement(variant));
}
function expectCodexSelectedInSessionTypeMenu() {
  fireEvent.click(screen.getByLabelText("Session Type"));
  expect(
    screen.getByRole("button", { name: /Codex/i }).getAttribute("aria-pressed"),
  ).toBe("true");
}

vi.mock("@/features/chat/components/providers/chat-presenter.provider", () => ({
  usePresenter: () => ({
    chatUiManager: {
      goToSession: mocks.goToSession,
      goToChatRoot: mocks.goToChatRoot,
    },
    chatSessionListManager: {
      createSession: mocks.createSession,
      setQuery: mocks.setQuery,
      setListMode: mocks.setListMode,
      selectSession: mocks.selectSession,
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
      openChildSessionPanel: mocks.openChildSessionPanel,
    },
  }),
}));

vi.mock("@/shared/components/doc-browser", () => ({
  useDocBrowser: () => ({
    open: mocks.docOpen,
  }),
}));

vi.mock(
  "@/features/chat/features/session/hooks/use-chat-session-update",
  () => ({
    useChatSessionLabel:
      () => async (params: { sessionKey: string; label: string | null }) => {
        mocks.sessionItems = mocks.sessionItems.map((item) =>
          item.session.key === params.sessionKey
            ? {
                ...item,
                session: {
                  ...item.session,
                  ...(params.label
                    ? { label: params.label }
                    : { label: undefined }),
                },
              }
            : item,
        );
        return mocks.updateNcpSession(params.sessionKey, {
          label: params.label,
        });
      },
  }),
);

vi.mock("@/features/chat/features/ncp/hooks/use-ncp-session-list-view", () => ({
  useNcpSessionListView: () => ({
    isLoading: mocks.isLoading,
    items: mocks.sessionItems,
  }),
}));

vi.mock("@/shared/components/common/brand-header", () => ({
  BrandHeader: () => <div data-testid="brand-header" />,
}));

vi.mock("@/shared/components/common/status-badge", () => ({
  StatusBadge: () => <div data-testid="status-badge" />,
}));

vi.mock("@/shared/hooks/use-agents", () => ({
  useAgents: () => ({
    data: {
      agents: mocks.agents,
    },
  }),
}));

vi.mock("@/app/components/i18n-provider", () => ({
  useI18n: () => ({
    language: "en",
    setLanguage: mocks.setLanguage,
  }),
}));

vi.mock("@/app/components/theme-provider", () => ({
  useTheme: () => ({
    theme: "warm",
    setTheme: mocks.setTheme,
  }),
}));

vi.mock("@/features/system-status", () => ({
  useSystemStatus: () => ({
    connectionStatus: "connected",
  }),
}));

function resetSidebarTestState() {
  window.localStorage.clear();
  viewportLayoutManager.resetForTests();
  mocks.createSession.mockReset();
  mocks.createSession.mockReturnValue("draft-session-key");
  mocks.goToSession.mockReset();
  mocks.goToChatRoot.mockReset();
  mocks.setQuery.mockReset();
  mocks.setListMode.mockReset();
  mocks.selectSession.mockReset();
  mocks.openChildSessionPanel.mockReset();
  mocks.docOpen.mockReset();
  mocks.setLanguage.mockReset();
  mocks.setTheme.mockReset();
  mocks.fetchPreference.mockReset();
  mocks.fetchPreference.mockResolvedValue({
    key: PREFERENCE_KEYS.chat.newSessionType,
    value: null,
  });
  mocks.updatePreference.mockReset();
  mocks.updatePreference.mockImplementation(
    async (key: string, value: string) => ({
      key,
      value,
      updatedAt: "2026-06-17T00:00:00.000Z",
    }),
  );
  mocks.updateNcpSession.mockReset();
  mocks.updateNcpSession.mockResolvedValue({});
  mocks.agents = [];
  mocks.sessionItems = [];
  mocks.isLoading = false;

  setSessionTypes([
    { value: "native", label: "Native", ready: true },
    { value: "codex", label: "Codex", ready: true },
  ]);
  useChatSessionListStore.setState({
    optimisticReadAtBySessionKey: {},
    snapshot: {
      ...useChatSessionListStore.getState().snapshot,
      query: "",
      listMode: "time-first",
      selectedSessionKey: null,
    },
  });
}

describe("ChatSidebar create and list basics", () => {
  beforeEach(resetSidebarTestState);

  it("switches the desktop new-session type without creating until the left button is clicked", async () => {
    renderSidebar();

    fireEvent.click(screen.getByLabelText("Session Type"));
    fireEvent.click(screen.getByRole("button", { name: /Codex/i }));

    expect(mocks.createSession).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(mocks.updatePreference).toHaveBeenCalledWith(
        PREFERENCE_KEYS.chat.newSessionType,
        "codex",
      );
      expect(screen.getByLabelText("Session Type").textContent).toBe("");
    });
    expectCodexSelectedInSessionTypeMenu();

    fireEvent.click(screen.getByRole("button", { name: "New Task" }));

    expect(mocks.createSession).toHaveBeenCalledWith("codex", undefined);
  });

  it("hydrates the desktop new-session type from stored preferences", async () => {
    mocks.fetchPreference.mockResolvedValue({
      key: PREFERENCE_KEYS.chat.newSessionType,
      value: "codex",
    });

    renderSidebar();

    await waitFor(() => {
      expect(screen.getByLabelText("Session Type").textContent).toBe("");
    });
    expectCodexSelectedInSessionTypeMenu();
    fireEvent.click(screen.getByLabelText("Session Type"));

    fireEvent.click(screen.getByRole("button", { name: "New Task" }));

    expect(mocks.createSession).toHaveBeenCalledWith("codex", undefined);
  });

  it("does not animate the desktop create task button width during runtime option hydration", () => {
    renderSidebar();

    const createButton = screen.getByRole("button", { name: "New Task" });
    const sessionTypeButton = screen.getByLabelText("Session Type");

    expect(createButton.className).not.toContain("transition-all");
    expect(sessionTypeButton.className).not.toContain("transition-all");
  });

  it("keeps the desktop brand row compact with symmetric vertical padding", () => {
    renderSidebar();

    expect(
      screen.getByTestId("brand-header").parentElement?.className,
    ).toContain("py-2.5");
  });

  it("shows setup required status for runtime session types that are not ready yet", () => {
    setSessionTypes([
      { value: "native", label: "Native", ready: true },
      {
        value: "claude",
        label: "Claude",
        ready: false,
        reasonMessage: "Configure a provider API key first.",
      },
    ]);

    renderSidebar();

    fireEvent.click(screen.getByLabelText("Session Type"));

    expect(screen.getByText("Claude")).not.toBeNull();
    expect(screen.getByText("Setup")).not.toBeNull();
    expect(
      screen.getByText("Configure a provider API key first."),
    ).not.toBeNull();
  });

  it("renders the lightweight list mode switch in the session header row and toggles to project view", () => {
    renderSidebar();

    expect(screen.getByText("Sessions")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Project" }));

    expect(mocks.setListMode).toHaveBeenCalledWith("project-first");
  });

  it("uses a compact mobile search and create toolbar", () => {
    renderSidebar("mobile");

    const searchInput = screen.getByPlaceholderText("Search conversations...");
    const createButton = screen.getByRole("button", { name: "New Task" });

    expect(searchInput.className).toContain("rounded-full");
    expect(createButton.textContent).toBe("");
    expect(screen.queryByText("New Task")).toBeNull();

    fireEvent.change(searchInput, { target: { value: "release notes" } });
    fireEvent.click(createButton);
    fireEvent.click(screen.getByText("Codex"));

    expect(mocks.setQuery).toHaveBeenCalledWith("release notes");
    expect(mocks.createSession).toHaveBeenCalledWith("codex", undefined);
    expect(mocks.goToChatRoot).not.toHaveBeenCalled();
  });

  it("keeps low-frequency utility choices behind nested selectors", () => {
    renderSidebar();

    expect(screen.queryByRole("button", { name: "Help Docs" })).toBeNull();
    expect(screen.queryByText("Language")).toBeNull();
    expect(screen.queryByRole("option", { name: "Cool" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Settings menu" }));
    expect(screen.getByText("Theme")).not.toBeNull();
    expect(screen.queryByRole("option", { name: "Cool" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Help Docs" }));

    expect(mocks.docOpen).toHaveBeenCalledWith(undefined, {
      kind: "docs",
      title: "Help Docs",
    });

    fireEvent.click(screen.getByRole("button", { name: "Settings menu" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Theme" }));
    fireEvent.click(screen.getByRole("option", { name: "Cool" }));

    expect(mocks.setTheme).toHaveBeenCalledWith("cool");
  });

  it("creates the default session directly from the compact mobile add button when no menu is needed", () => {
    setSessionTypes([{ value: "native", label: "Native", ready: true }]);

    renderSidebar("mobile");

    fireEvent.click(screen.getByRole("button", { name: "New Task" }));

    expect(mocks.createSession).toHaveBeenCalledWith("native", undefined);
    expect(mocks.goToChatRoot).not.toHaveBeenCalled();
  });

  it("shows a session type badge for non-native sessions in the list", () => {
    mocks.sessionItems = [
      createSessionItem({
        key: "session:codex-1",
        createdAt: "2026-03-19T09:00:00.000Z",
        updatedAt: "2026-03-19T09:05:00.000Z",
        label: "Codex Task",
        sessionType: "codex",
        sessionTypeMutable: false,
        messageCount: 2,
      }),
    ];

    renderSidebar();

    expect(screen.getByText("Codex Task")).not.toBeNull();
    expect(screen.getByText("Codex")).not.toBeNull();
    expect(screen.queryByText("session:codex-1")).toBeNull();
  });

  it("formats non-native session badges generically when the type is no longer in the available options", () => {
    setSessionTypes([{ value: "native", label: "Native" }]);
    mocks.sessionItems = [
      createSessionItem({
        key: "session:workspace-agent-1",
        createdAt: "2026-03-19T09:00:00.000Z",
        updatedAt: "2026-03-19T09:05:00.000Z",
        label: "Workspace Task",
        sessionType: "workspace-agent",
        sessionTypeMutable: false,
        messageCount: 2,
      }),
    ];

    renderSidebar();

    expect(screen.getByText("Workspace Task")).not.toBeNull();
    expect(screen.getByText("Workspace Agent")).not.toBeNull();
  });

  it("does not show a session type badge for native sessions in the list", () => {
    setSessionTypes([{ value: "native", label: "Native" }]);
    mocks.sessionItems = [
      createSessionItem({
        key: "session:native-1",
        createdAt: "2026-03-19T09:00:00.000Z",
        updatedAt: "2026-03-19T09:05:00.000Z",
        label: "Native Task",
        sessionType: "native",
        sessionTypeMutable: false,
        messageCount: 1,
      }),
    ];

    renderSidebar();

    expect(screen.getByText("Native Task")).not.toBeNull();
    expect(screen.queryByText("Native")).toBeNull();
  });
});

describe("ChatSidebar activity ordering", () => {
  beforeEach(resetSidebarTestState);

  it("orders sessions by last message time and ignores metadata updatedAt changes", () => {
    mocks.sessionItems = [
      createSessionItem({
        key: "session:message-newer",
        createdAt: "2026-03-19T08:00:00.000Z",
        updatedAt: "2026-03-19T09:00:00.000Z",
        lastMessageAt: "2026-03-19T09:00:00.000Z",
        label: "Message Newer",
        sessionType: "native",
        sessionTypeMutable: false,
        messageCount: 1,
      }),
      createSessionItem({
        key: "session:metadata-newer",
        createdAt: "2026-03-19T07:00:00.000Z",
        updatedAt: "2026-03-19T12:00:00.000Z",
        lastMessageAt: "2026-03-19T08:00:00.000Z",
        label: "Metadata Newer",
        sessionType: "native",
        sessionTypeMutable: false,
        messageCount: 1,
      }),
    ];

    renderSidebar();

    const messageNewer = screen.getByText("Message Newer");
    const metadataNewer = screen.getByText("Metadata Newer");

    expect(
      messageNewer.compareDocumentPosition(metadataNewer) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("uses createdAt for sorting sessions without messages", () => {
    mocks.sessionItems = [
      createSessionItem({
        key: "session:created-older",
        createdAt: "2026-03-19T08:00:00.000Z",
        updatedAt: "2026-03-19T12:00:00.000Z",
        label: "Created Older",
        sessionType: "native",
        sessionTypeMutable: false,
        messageCount: 0,
      }),
      createSessionItem({
        key: "session:created-newer",
        createdAt: "2026-03-19T09:00:00.000Z",
        updatedAt: "2026-03-19T10:00:00.000Z",
        label: "Created Newer",
        sessionType: "native",
        sessionTypeMutable: false,
        messageCount: 0,
      }),
    ];

    renderSidebar();

    const createdNewer = screen.getByText("Created Newer");
    const createdOlder = screen.getByText("Created Older");

    expect(
      createdNewer.compareDocumentPosition(createdOlder) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe("ChatSidebar project-first mode", () => {
  beforeEach(resetSidebarTestState);

  it("shows project groups only in project-first mode and hides sessions without a project", () => {
    useChatSessionListStore.setState({
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        listMode: "project-first",
      },
    });
    mocks.sessionItems = [
      createSessionItem({
        key: "session:project-1",
        createdAt: "2026-03-19T09:00:00.000Z",
        updatedAt: "2026-03-19T11:05:00.000Z",
        label: "Project Alpha Task",
        projectRoot: "/tmp/project-alpha",
        projectName: "project-alpha",
        sessionType: "native",
        sessionTypeMutable: false,
        messageCount: 2,
      }),
      createSessionItem({
        key: "session:plain-1",
        createdAt: "2026-03-19T08:00:00.000Z",
        updatedAt: "2026-03-19T08:05:00.000Z",
        label: "Loose Task",
        sessionType: "native",
        sessionTypeMutable: false,
        messageCount: 1,
      }),
    ];

    renderSidebar();

    expect(screen.getByText("project-alpha")).not.toBeNull();
    expect(screen.getByText("Project Alpha Task")).not.toBeNull();
    expect(screen.queryByText("Loose Task")).toBeNull();
  });

  it("lets the user choose a runtime type when creating a project-bound draft", () => {
    useChatSessionListStore.setState({
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        listMode: "project-first",
      },
    });
    mocks.sessionItems = [
      createSessionItem({
        key: "session:project-2",
        createdAt: "2026-03-19T09:00:00.000Z",
        updatedAt: "2026-03-19T11:05:00.000Z",
        label: "Grouped Task",
        projectRoot: "/tmp/project-beta",
        projectName: "project-beta",
        sessionType: "native",
        sessionTypeMutable: false,
        messageCount: 2,
      }),
    ];

    renderSidebar();

    fireEvent.click(
      screen.getByRole("button", { name: "New Task · project-beta" }),
    );
    fireEvent.click(screen.getByText("Codex"));

    expect(mocks.createSession).toHaveBeenCalledWith(
      "codex",
      "/tmp/project-beta",
    );
    expect(mocks.goToSession).not.toHaveBeenCalled();
  });

  it("creates immediately when there is only one available runtime type", () => {
    setSessionTypes([{ value: "native", label: "Native", ready: true }]);
    useChatSessionListStore.setState({
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        listMode: "project-first",
      },
    });
    mocks.sessionItems = [
      createSessionItem({
        key: "session:project-3",
        createdAt: "2026-03-19T09:00:00.000Z",
        updatedAt: "2026-03-19T11:05:00.000Z",
        label: "Single Runtime Task",
        projectRoot: "/tmp/project-gamma",
        projectName: "project-gamma",
        sessionType: "native",
        sessionTypeMutable: false,
        messageCount: 2,
      }),
    ];

    renderSidebar();

    fireEvent.click(
      screen.getByRole("button", { name: "New Task · project-gamma" }),
    );

    expect(mocks.createSession).toHaveBeenCalledWith(
      "native",
      "/tmp/project-gamma",
    );
    expect(mocks.goToSession).not.toHaveBeenCalled();
  });

  it("opens the draft detail after creating a project-bound session on mobile", () => {
    useChatSessionListStore.setState({
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        listMode: "project-first",
      },
    });
    mocks.sessionItems = [
      createSessionItem({
        key: "session:project-mobile-1",
        createdAt: "2026-03-19T09:00:00.000Z",
        updatedAt: "2026-03-19T11:05:00.000Z",
        label: "Grouped Mobile Task",
        projectRoot: "/tmp/project-mobile",
        projectName: "project-mobile",
        sessionType: "native",
        sessionTypeMutable: false,
        messageCount: 2,
      }),
    ];

    renderSidebar("mobile");

    fireEvent.click(
      screen.getByRole("button", { name: "New Task · project-mobile" }),
    );
    fireEvent.click(screen.getByText("Codex"));

    expect(mocks.createSession).toHaveBeenCalledWith(
      "codex",
      "/tmp/project-mobile",
    );
    expect(mocks.goToChatRoot).not.toHaveBeenCalled();
  });
});

describe("ChatSidebar session item interactions", () => {
  beforeEach(resetSidebarTestState);

  it("hides the sidebar agent avatar for the main agent but keeps specialist avatars", () => {
    mocks.agents = [
      { id: "main", displayName: "Main" },
      { id: "engineer", displayName: "Engineer" },
    ];
    mocks.sessionItems = [
      createSessionItem({
        key: "session:main-1",
        createdAt: "2026-03-19T09:00:00.000Z",
        updatedAt: "2026-03-19T09:05:00.000Z",
        label: "Main Task",
        sessionType: "native",
        sessionTypeMutable: false,
        messageCount: 1,
        agentId: "main",
      }),
      createSessionItem({
        key: "session:engineer-1",
        createdAt: "2026-03-19T10:00:00.000Z",
        updatedAt: "2026-03-19T10:05:00.000Z",
        label: "Engineer Task",
        sessionType: "native",
        sessionTypeMutable: false,
        messageCount: 1,
        agentId: "engineer",
      }),
    ];

    renderSidebar();

    expect(screen.queryByLabelText("Main")).toBeNull();
    expect(screen.getByLabelText("Engineer")).not.toBeNull();
  });

  it("edits the session label inline and saves through the ncp session api by default", async () => {
    mocks.sessionItems = [
      createSessionItem({
        key: "session:ncp-1",
        createdAt: "2026-03-19T09:00:00.000Z",
        updatedAt: "2026-03-19T09:05:00.000Z",
        label: "Initial Label",
        sessionType: "native",
        sessionTypeMutable: false,
        messageCount: 1,
      }),
    ];

    renderSidebar();

    fireEvent.click(screen.getByLabelText("Edit"));
    fireEvent.change(screen.getByPlaceholderText("Session label (optional)"), {
      target: { value: "Renamed Label" },
    });
    fireEvent.click(screen.getByLabelText("Save"));

    await waitFor(() => {
      expect(mocks.updateNcpSession).toHaveBeenCalledWith("session:ncp-1", {
        label: "Renamed Label",
      });
    });
    expect(screen.getByText("Renamed Label")).not.toBeNull();
  });

  it("cancels inline session label editing without saving", () => {
    mocks.sessionItems = [
      createSessionItem({
        key: "session:ncp-2",
        createdAt: "2026-03-19T09:00:00.000Z",
        updatedAt: "2026-03-19T09:05:00.000Z",
        label: "Cancelable Label",
        sessionType: "native",
        sessionTypeMutable: false,
        messageCount: 1,
      }),
    ];

    renderSidebar();

    fireEvent.click(screen.getByLabelText("Edit"));
    fireEvent.change(screen.getByPlaceholderText("Session label (optional)"), {
      target: { value: "Should Not Persist" },
    });
    fireEvent.click(screen.getByLabelText("Cancel"));

    expect(mocks.updateNcpSession).not.toHaveBeenCalled();
    expect(screen.queryByDisplayValue("Should Not Persist")).toBeNull();
    expect(screen.getByText("Cancelable Label")).not.toBeNull();
  });

  it("shows an unread dot only after a non-active session finishes its newer update", () => {
    mocks.sessionItems = [
      createSessionItem({
        key: "session:ncp-1",
        createdAt: "2026-03-19T09:00:00.000Z",
        updatedAt: "2026-03-19T09:05:00.000Z",
        lastMessageAt: "2026-03-19T09:05:00.000Z",
        readAt: "2026-03-19T09:05:00.000Z",
        label: "Current Task",
        sessionType: "native",
        sessionTypeMutable: false,
        messageCount: 1,
      }),
      createSessionItem(
        {
          key: "session:ncp-2",
          createdAt: "2026-03-19T10:00:00.000Z",
          updatedAt: "2026-03-19T10:05:00.000Z",
          lastMessageAt: "2026-03-19T10:05:00.000Z",
          readAt: "2026-03-19T10:05:00.000Z",
          label: "Background Task",
          sessionType: "native",
          sessionTypeMutable: false,
          messageCount: 1,
        },
        "running",
      ),
    ];
    useChatSessionListStore.setState({
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        selectedSessionKey: "session:ncp-1",
      },
    });

    const { rerender } = renderSidebar();

    expect(screen.queryByLabelText("Session has unread updates")).toBeNull();

    mocks.sessionItems = [
      mocks.sessionItems[0]!,
      createSessionItem(
        {
          key: "session:ncp-2",
          createdAt: "2026-03-19T10:00:00.000Z",
          updatedAt: "2026-03-19T10:06:00.000Z",
          lastMessageAt: "2026-03-19T10:06:00.000Z",
          readAt: "2026-03-19T10:05:00.000Z",
          label: "Background Task",
          sessionType: "native",
          sessionTypeMutable: false,
          messageCount: 2,
        },
        "running",
      ),
    ];

    rerender(sidebarElement());

    expect(screen.queryByLabelText("Session has unread updates")).toBeNull();

    mocks.sessionItems = [
      mocks.sessionItems[0]!,
      createSessionItem({
        key: "session:ncp-2",
        createdAt: "2026-03-19T10:00:00.000Z",
        updatedAt: "2026-03-19T10:06:00.000Z",
        lastMessageAt: "2026-03-19T10:06:00.000Z",
        readAt: "2026-03-19T10:05:00.000Z",
        label: "Background Task",
        sessionType: "native",
        sessionTypeMutable: false,
        messageCount: 2,
      }),
    ];

    rerender(sidebarElement());

    expect(screen.getByLabelText("Session has unread updates")).toBeTruthy();

    useChatSessionListStore.setState({
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        selectedSessionKey: "session:ncp-2",
      },
    });

    rerender(sidebarElement());

    expect(screen.queryByLabelText("Session has unread updates")).toBeNull();
  });

  it("does not show an unread dot for sessions without a persisted ui read baseline", () => {
    mocks.sessionItems = [
      createSessionItem({
        key: "session:ncp-legacy",
        createdAt: "2026-03-19T09:00:00.000Z",
        updatedAt: "2026-03-19T09:05:00.000Z",
        lastMessageAt: "2026-03-19T09:05:00.000Z",
        label: "Legacy Session",
        sessionType: "native",
        sessionTypeMutable: false,
        messageCount: 1,
      }),
    ];

    renderSidebar();

    expect(screen.queryByLabelText("Session has unread updates")).toBeNull();
  });

  it("opens the child-session browser from a parent session row", () => {
    mocks.sessionItems = [
      createSessionItem({
        key: "session:parent-1",
        createdAt: "2026-03-19T09:00:00.000Z",
        updatedAt: "2026-03-19T09:05:00.000Z",
        label: "Parent Task",
        sessionType: "native",
        sessionTypeMutable: false,
        messageCount: 1,
      }),
      createSessionItem({
        key: "session:child-1",
        createdAt: "2026-03-19T09:06:00.000Z",
        updatedAt: "2026-03-19T09:07:00.000Z",
        label: "Child Task",
        sessionType: "native",
        sessionTypeMutable: false,
        messageCount: 1,
        parentSessionId: "session:parent-1",
      }),
    ];

    renderSidebar();

    fireEvent.click(screen.getByLabelText("View child sessions"));

    expect(mocks.openChildSessionPanel).toHaveBeenCalledWith({
      parentSessionKey: "session:parent-1",
      activeChildSessionKey: "session:child-1",
    });
  });
});
