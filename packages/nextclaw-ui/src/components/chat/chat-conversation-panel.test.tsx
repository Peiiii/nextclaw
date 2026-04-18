import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatConversationPanel } from "@/components/chat/chat-conversation-panel";
import { ChatSessionWorkspacePanel } from "@/components/chat/chat-session-workspace-panel";
import type { ResolvedChildSessionTab } from "@/components/chat/ncp/session-conversation/use-ncp-child-session-tabs-view";
import { useChatInputStore } from "@/components/chat/stores/chat-input.store";
import { useChatSessionListStore } from "@/components/chat/stores/chat-session-list.store";
import { useChatThreadStore } from "@/components/chat/stores/chat-thread.store";

const mocks = vi.hoisted(() => ({
  deleteSession: vi.fn(),
  goToProviders: vi.fn(),
  createSession: vi.fn(),
  setSelectedAgentId: vi.fn(),
  setPendingSessionType: vi.fn(),
  stickyBottomScroll: vi.fn(() => ({
    onScroll: vi.fn(),
  })),
  resolvedChildTabs: [
    {
      sessionKey: "child-session-1",
      parentSessionKey: "parent-session-1",
      title: "北京天气",
      agentId: "weather",
      updatedAt: "2026-04-10T09:00:00.000Z",
      lastMessageAt: "2026-04-10T09:00:00.000Z",
      readAt: "2026-04-10T09:00:00.000Z",
      sessionTypeLabel: "Codex",
      preferredModel: "openai/gpt-5.3-codex",
      projectName: "project-alpha",
      projectRoot: "/Users/demo/project-alpha",
    },
  ] as ResolvedChildSessionTab[],
}));

vi.mock("@nextclaw/agent-chat-ui", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    useStickyBottomScroll: mocks.stickyBottomScroll,
  };
});

vi.mock("@/components/chat/nextclaw", () => ({
  ChatInputBarContainer: () => <div data-testid="chat-input-bar" />,
  ChatMessageListContainer: () => <div data-testid="chat-message-list" />,
}));

vi.mock("@/components/chat/containers/chat-message-list.container", () => ({
  ChatMessageListContainer: () => <div data-testid="child-chat-message-list" />,
}));

vi.mock("@/components/chat/chat-session-workspace-file-preview", () => ({
  ChatSessionWorkspaceFilePreview: ({
    file,
  }: {
    file: { path: string };
  }) => <div data-testid="workspace-file-preview">{file.path}</div>,
}));

vi.mock("@/components/chat/ChatWelcome", () => ({
  ChatWelcome: ({
    onCreateSession,
    onSelectAgent,
  }: {
    onCreateSession: () => void;
    onSelectAgent: (agentId: string) => void;
  }) => (
    <div data-testid="chat-welcome">
      <button type="button" onClick={onCreateSession}>
        create draft session
      </button>
      <button type="button" onClick={() => onSelectAgent("engineer")}>
        switch draft agent
      </button>
    </div>
  ),
}));

vi.mock("@/components/chat/presenter/chat-presenter-context", () => ({
  usePresenter: () => ({
    chatThreadManager: {
      deleteSession: mocks.deleteSession,
      goToProviders: mocks.goToProviders,
      openChildSessionPanel: vi.fn(),
      openFilePreview: vi.fn(),
      openSessionFromToolAction: vi.fn(),
      selectChildSessionDetail: vi.fn(),
      selectWorkspaceFile: vi.fn(),
      closeWorkspaceFile: vi.fn(),
      closeWorkspacePanel: vi.fn(),
      goToParentSession: vi.fn(),
    },
    chatSessionListManager: {
      selectSession: vi.fn(),
      createSession: mocks.createSession,
      setSelectedAgentId: mocks.setSelectedAgentId,
      markSessionRead: (
        sessionKey: string | null | undefined,
        readAt: string | null | undefined,
      ) =>
        sessionKey
          ? useChatSessionListStore.getState().markSessionRead(
              sessionKey,
              readAt,
            )
          : undefined,
    },
    chatInputManager: {
      setPendingSessionType: mocks.setPendingSessionType,
    },
  }),
}));

vi.mock("@/components/chat/session-header/chat-session-header-actions", () => ({
  ChatSessionHeaderActions: () => <button aria-label="More actions" />,
}));

vi.mock("@/components/chat/session-header/chat-session-project-badge", () => ({
  ChatSessionProjectBadge: ({ projectName }: { projectName: string }) => (
    <button>{projectName}</button>
  ),
}));

vi.mock(
  "@/components/chat/ncp/session-conversation/use-ncp-child-session-tabs-view",
  () => ({
    useNcpChildSessionTabsView: () => mocks.resolvedChildTabs,
  }),
);

vi.mock(
  "@/components/chat/ncp/session-conversation/use-ncp-session-conversation",
  () => ({
    useNcpSessionConversation: () => ({
      visibleMessages: [],
      isHydrating: false,
      hydrateError: null,
      isRunning: false,
    }),
  }),
);

vi.mock("@/components/common/AgentAvatar", () => ({
  AgentAvatar: ({ agentId }: { agentId: string }) => (
    <div data-testid="agent-avatar">{agentId}</div>
  ),
}));

vi.mock("@/components/common/agent-identity", () => ({
  AgentIdentityAvatar: ({ agentId }: { agentId: string }) => (
    <div data-testid="agent-identity-avatar">{agentId}</div>
  ),
}));

describe("ChatConversationPanel", () => {
  beforeEach(() => {
    mocks.deleteSession.mockReset();
    mocks.goToProviders.mockReset();
    mocks.createSession.mockReset();
    mocks.setSelectedAgentId.mockReset();
    mocks.setPendingSessionType.mockReset();
    mocks.stickyBottomScroll.mockClear();
    useChatInputStore.setState({
      snapshot: {
        ...useChatInputStore.getState().snapshot,
        defaultSessionType: "native",
      },
    });
    useChatThreadStore.setState({
      snapshot: {
        ...useChatThreadStore.getState().snapshot,
        isProviderStateResolved: true,
        modelOptions: [
          {
            value: "openai/gpt-5.1",
            modelLabel: "gpt-5.1",
            providerLabel: "OpenAI",
          } as never,
        ],
        sessionTypeLabel: "Codex",
        sessionKey: "draft-session-1",
        sessionDisplayName: undefined,
        agentId: null,
        agentDisplayName: null,
        sessionProjectRoot: null,
        sessionProjectName: null,
        canDeleteSession: false,
        isDeletePending: false,
        isHistoryLoading: false,
        messages: [],
        isSending: false,
        isAwaitingAssistantOutput: false,
        parentSessionKey: null,
        parentSessionLabel: null,
        workspacePanelParentKey: null,
        availableAgents: [
          { id: "main", displayName: "Main", runtime: "native" },
          { id: "engineer", displayName: "Engineer", runtime: "codex" },
        ],
        childSessionTabs: [],
        activeChildSessionKey: null,
        workspaceFileTabs: [],
        activeWorkspaceFileKey: null,
      },
    });
    useChatSessionListStore.setState({
      optimisticReadAtBySessionKey: {},
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
      },
    });
  });

  it("shows the draft session type in the conversation header", () => {
    render(<ChatConversationPanel />);

    expect(screen.getByText("New Task")).toBeTruthy();
    expect(screen.getByText("Codex")).toBeTruthy();
    expect(screen.getByLabelText("More actions")).toBeTruthy();
  });

  it("shows the selected session project badge and more actions trigger", () => {
    useChatThreadStore.setState({
      snapshot: {
        ...useChatThreadStore.getState().snapshot,
        sessionKey: "session-1",
        sessionDisplayName: "Project Thread",
        sessionProjectRoot: "/Users/demo/workspace/project-alpha",
        sessionProjectName: "project-alpha",
        canDeleteSession: true,
      },
    });

    render(<ChatConversationPanel />);

    expect(screen.getByText("Project Thread")).toBeTruthy();
    expect(screen.getByText("project-alpha")).toBeTruthy();
    expect(screen.getByLabelText("More actions")).toBeTruthy();
  });

  it("does not show a header agent marker for the main agent", () => {
    useChatThreadStore.setState({
      snapshot: {
        ...useChatThreadStore.getState().snapshot,
        agentId: "main",
        agentDisplayName: "Main",
      },
    });

    render(<ChatConversationPanel />);

    expect(screen.queryByTestId("agent-avatar")).toBeNull();
  });

  it("shows only a lightweight avatar marker for a specialist agent", () => {
    useChatThreadStore.setState({
      snapshot: {
        ...useChatThreadStore.getState().snapshot,
        agentId: "engineer",
        agentDisplayName: "Engineer",
      },
    });

    render(<ChatConversationPanel />);

    expect(screen.getByTestId("agent-avatar").textContent).toBe("engineer");
    expect(screen.queryByText("Engineer")).toBeNull();
  });

  it("renders a fuller loading skeleton before provider state settles", () => {
    useChatThreadStore.setState({
      snapshot: {
        ...useChatThreadStore.getState().snapshot,
        isProviderStateResolved: false,
      },
    });

    render(<ChatConversationPanel />);

    expect(screen.getByTestId("chat-conversation-skeleton")).toBeTruthy();
    expect(
      screen.getAllByTestId("chat-conversation-skeleton-bubble"),
    ).toHaveLength(4);
    expect(screen.queryByTestId("chat-input-bar")).toBeNull();
  });

  it("keeps the message area clean while a session history is hydrating", () => {
    useChatThreadStore.setState({
      snapshot: {
        ...useChatThreadStore.getState().snapshot,
        sessionKey: "session-1",
        canDeleteSession: true,
        isHistoryLoading: true,
        messages: [],
      },
    });

    render(<ChatConversationPanel />);

    expect(
      screen.queryByRole("status", { name: "Loading session history..." }),
    ).toBeNull();
    expect(screen.queryByText("No messages yet. Send one to start.")).toBeNull();
  });

  it("does not auto-open the child-session panel until the panel is explicitly opened", () => {
    useChatThreadStore.setState({
      snapshot: {
        ...useChatThreadStore.getState().snapshot,
        sessionKey: "parent-session-1",
        sessionDisplayName: "Parent Session",
        canDeleteSession: true,
        childSessionTabs: [
          {
            sessionKey: "child-session-1",
            parentSessionKey: "parent-session-1",
            label: "北京天气",
            agentId: "weather",
          },
        ],
        activeChildSessionKey: "child-session-1",
        workspacePanelParentKey: null,
      },
    });

    render(<ChatConversationPanel />);

    expect(screen.queryByLabelText("Close child session panel")).toBeNull();
  });

  it("creates a draft session with the selected draft agent runtime", async () => {
    const user = userEvent.setup();

    useChatThreadStore.setState({
      snapshot: {
        ...useChatThreadStore.getState().snapshot,
        agentId: "engineer",
        agentDisplayName: "Engineer",
      },
    });

    render(<ChatConversationPanel />);

    await user.click(
      screen.getByRole("button", { name: "create draft session" }),
    );

    expect(mocks.createSession).toHaveBeenCalledWith("codex");
  });

  it("syncs the pending session type when switching the draft agent", async () => {
    const user = userEvent.setup();

    render(<ChatConversationPanel />);

    await user.click(
      screen.getByRole("button", { name: "switch draft agent" }),
    );

    expect(mocks.setSelectedAgentId).toHaveBeenCalledWith("engineer");
    expect(mocks.setPendingSessionType).toHaveBeenCalledWith("codex");
  });
});

describe("ChatSessionWorkspacePanel", () => {
  it("renders child session tabs and active child metadata in the workspace sidebar", () => {
    mocks.resolvedChildTabs = [
      {
        sessionKey: "child-session-1",
        parentSessionKey: "parent-session-1",
        title: "北京天气",
        agentId: "weather",
        updatedAt: "2026-04-10T09:00:00.000Z",
        lastMessageAt: "2026-04-10T09:00:00.000Z",
        readAt: "2026-04-10T09:00:00.000Z",
        sessionTypeLabel: "Codex",
        preferredModel: "openai/gpt-5.3-codex",
        projectName: "project-alpha",
        projectRoot: "/Users/demo/project-alpha",
      },
    ];

    render(
      <ChatSessionWorkspacePanel
        childSessionTabs={[
          {
            sessionKey: "child-session-1",
            parentSessionKey: "parent-session-1",
            label: "北京天气",
            agentId: "weather",
          },
        ]}
        activeChildSessionKey="child-session-1"
        workspaceFileTabs={[]}
        activeWorkspaceFileKey={null}
        sessionProjectRoot="/Users/demo/project-alpha"
        onSelectSession={vi.fn()}
        onSelectFile={vi.fn()}
        onCloseFile={vi.fn()}
        onClose={vi.fn()}
        onBackToParent={vi.fn()}
        onFileOpen={vi.fn()}
      />,
    );

    expect(screen.queryByText("Child sessions")).toBeNull();
    expect(screen.getAllByText("北京天气")).toHaveLength(2);
    expect(screen.getByText("Codex")).toBeTruthy();
    expect(screen.getByText("openai/gpt-5.3-codex")).toBeTruthy();
    expect(screen.getByText("project-alpha")).toBeTruthy();
    expect(screen.getByText("/Users/demo/project-alpha")).toBeTruthy();
    expect(screen.getByText("No child session messages yet.")).toBeTruthy();
    expect(mocks.stickyBottomScroll).toHaveBeenCalledWith(
      expect.objectContaining({
        resetKey: "child-session-1",
        stickyThresholdPx: 20,
      }),
    );
  });

  it("shows unread state for inactive child session tabs", () => {
    mocks.resolvedChildTabs = [
      {
        sessionKey: "child-session-1",
        parentSessionKey: "parent-session-1",
        title: "北京天气",
        agentId: "weather",
        updatedAt: "2026-04-10T09:00:00.000Z",
        lastMessageAt: "2026-04-10T09:00:00.000Z",
        readAt: "2026-04-10T09:00:00.000Z",
        sessionTypeLabel: "Codex",
        preferredModel: "openai/gpt-5.3-codex",
        projectName: "project-alpha",
        projectRoot: "/Users/demo/project-alpha",
      },
      {
        sessionKey: "child-session-2",
        parentSessionKey: "parent-session-1",
        title: "上海天气",
        agentId: "weather",
        updatedAt: "2026-04-10T09:05:00.000Z",
        lastMessageAt: "2026-04-10T09:06:00.000Z",
        readAt: "2026-04-10T09:05:00.000Z",
        sessionTypeLabel: "Claude Code",
        preferredModel: "anthropic/claude-sonnet-4",
        projectName: "project-beta",
        projectRoot: "/Users/demo/project-beta",
      },
    ];

    render(
      <ChatSessionWorkspacePanel
        childSessionTabs={[
          {
            sessionKey: "child-session-1",
            parentSessionKey: "parent-session-1",
            label: "北京天气",
            agentId: "weather",
          },
          {
            sessionKey: "child-session-2",
            parentSessionKey: "parent-session-1",
            label: "上海天气",
            agentId: "weather",
          },
        ]}
        activeChildSessionKey="child-session-1"
        workspaceFileTabs={[]}
        activeWorkspaceFileKey={null}
        sessionProjectRoot="/Users/demo/project-alpha"
        onSelectSession={vi.fn()}
        onSelectFile={vi.fn()}
        onCloseFile={vi.fn()}
        onClose={vi.fn()}
        onBackToParent={vi.fn()}
        onFileOpen={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Session has unread updates")).toBeTruthy();
  });

  it("shows opened files as top tabs and renders the file preview pane", () => {
    render(
      <ChatSessionWorkspacePanel
        childSessionTabs={[]}
        activeChildSessionKey={null}
        workspaceFileTabs={[
          {
            key: "parent-session-1::preview::README.md",
            parentSessionKey: "parent-session-1",
            path: "README.md",
            label: "README.md",
            viewMode: "preview",
          },
        ]}
        activeWorkspaceFileKey="parent-session-1::preview::README.md"
        sessionProjectRoot="/Users/demo/project-alpha"
        onSelectSession={vi.fn()}
        onSelectFile={vi.fn()}
        onCloseFile={vi.fn()}
        onClose={vi.fn()}
        onBackToParent={vi.fn()}
        onFileOpen={vi.fn()}
      />,
    );

    expect(screen.queryByText("Open files")).toBeNull();
    expect(screen.getAllByText("README.md").length).toBeGreaterThan(0);
    expect(screen.getByTestId("workspace-file-preview").textContent).toBe(
      "README.md",
    );
    expect(screen.getByTestId("workspace-tabs-bar").className).toContain(
      "workspace-horizontal-scrollbar",
    );
  });
});
