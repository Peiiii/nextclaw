import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatConversationPanel } from "@/features/chat/components/conversation/chat-conversation-panel";
import { ChatSessionWorkspacePanel } from "@/features/chat/components/chat-session-workspace-panel";
import type { ResolvedChildSessionTab } from "@/features/chat/hooks/use-ncp-child-session-tabs-view";
import type { CronJobView } from "@/shared/lib/api";
import { useChatInputStore } from "@/features/chat/stores/chat-input.store";
import { useChatSessionListStore } from "@/features/chat/stores/chat-session-list.store";
import { useChatThreadStore } from "@/features/chat/stores/chat-thread.store";

const mocks = vi.hoisted(() => ({
  deleteSession: vi.fn(),
  goToProviders: vi.fn(),
  createSession: vi.fn(() => "draft-session-2"),
  goToChatRoot: vi.fn(),
  goToSession: vi.fn(),
  openSessionCronPanel: vi.fn(),
  goBackWorkspacePanel: vi.fn(),
  goForwardWorkspacePanel: vi.fn(),
  deleteCronJob: vi.fn(),
  cronJobs: [] as CronJobView[],
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

vi.mock(
  "@/features/chat/components/conversation/chat-input-bar.container",
  () => ({
    ChatInputBarContainer: () => <div data-testid="chat-input-bar" />,
  }),
);

vi.mock(
  "@/features/chat/components/conversation/chat-message-list.container",
  () => ({
    ChatMessageListContainer: ({
      isSending,
      messages,
    }: {
      isSending: boolean;
      messages: readonly unknown[];
    }) => (
      <div
        data-testid="chat-message-list"
        data-message-count={String(messages.length)}
        data-sending={String(isSending)}
      />
    ),
  }),
);

vi.mock(
  "@/features/chat/components/chat-session-workspace-file-preview",
  () => ({
    ChatSessionWorkspaceFilePreview: ({ file }: { file: { path: string } }) => (
      <div data-testid="workspace-file-preview">{file.path}</div>
    ),
  }),
);

vi.mock("@/features/chat/components/chat-welcome", () => ({
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

vi.mock("@/features/chat/components/providers/chat-presenter.provider", () => ({
  usePresenter: () => ({
    chatUiManager: {
      goToChatRoot: mocks.goToChatRoot,
      goToSession: mocks.goToSession,
    },
    chatThreadManager: {
      deleteSession: mocks.deleteSession,
      goToProviders: mocks.goToProviders,
      openChildSessionPanel: vi.fn(),
      openSessionCronPanel: mocks.openSessionCronPanel,
      openFilePreview: vi.fn(),
      openSessionFromToolAction: vi.fn(),
      selectChildSessionDetail: vi.fn(),
      selectWorkspaceFile: vi.fn(),
      closeWorkspaceFile: vi.fn(),
      closeWorkspacePanel: vi.fn(),
      goBackWorkspacePanel: mocks.goBackWorkspacePanel,
      goForwardWorkspacePanel: mocks.goForwardWorkspacePanel,
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
          ? useChatSessionListStore
              .getState()
              .markSessionRead(sessionKey, readAt)
          : undefined,
    },
    chatInputManager: {
      setPendingSessionType: mocks.setPendingSessionType,
    },
  }),
}));

vi.mock("@/shared/hooks/use-config", () => ({
  useCronJobs: () => ({
    data: { jobs: mocks.cronJobs, total: mocks.cronJobs.length },
  }),
  useDeleteCronJob: () => ({
    mutate: mocks.deleteCronJob,
    isPending: false,
  }),
}));

vi.mock(
  "@/features/chat/components/conversation/session-header/chat-session-header-actions",
  () => ({
    ChatSessionHeaderActions: () => <button aria-label="More actions" />,
  }),
);

vi.mock(
  "@/features/chat/components/conversation/session-header/chat-session-project-badge",
  () => ({
    ChatSessionProjectBadge: ({ projectName }: { projectName: string }) => (
      <button>{projectName}</button>
    ),
  }),
);

vi.mock("@/features/chat/hooks/use-ncp-child-session-tabs-view", () => ({
  useNcpChildSessionTabsView: () => mocks.resolvedChildTabs,
}));

vi.mock("@/features/chat/hooks/use-ncp-session-conversation", () => ({
  useNcpSessionConversation: () => ({
    visibleMessages: [],
    isHydrating: false,
    hydrateError: null,
    isRunning: false,
  }),
}));

vi.mock("@/shared/components/common/agent-avatar", () => ({
  AgentAvatar: ({ agentId }: { agentId: string }) => (
    <div data-testid="agent-avatar">{agentId}</div>
  ),
}));

vi.mock("@/shared/components/common/agent-identity", () => ({
  AgentIdentityAvatar: ({ agentId }: { agentId: string }) => (
    <div data-testid="agent-identity-avatar">{agentId}</div>
  ),
}));

function resetChatConversationPanelTestState() {
  mocks.deleteSession.mockReset();
  mocks.goToProviders.mockReset();
  mocks.createSession.mockReset();
  mocks.createSession.mockReturnValue("draft-session-2");
  mocks.goToChatRoot.mockReset();
  mocks.goToSession.mockReset();
  mocks.openSessionCronPanel.mockReset();
  mocks.goBackWorkspacePanel.mockReset();
  mocks.goForwardWorkspacePanel.mockReset();
  mocks.deleteCronJob.mockReset();
  mocks.cronJobs = [];
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
      hasSubmittedDraftMessage: false,
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
      workspaceNavigationHistory: [],
      workspaceNavigationHistoryIndex: 0,
    },
  });
  useChatSessionListStore.setState({
    optimisticReadAtBySessionKey: {},
    snapshot: {
      ...useChatSessionListStore.getState().snapshot,
    },
  });
}

describe("ChatConversationPanel", () => {
  beforeEach(resetChatConversationPanelTestState);

  it("shows the draft session type in the conversation header", () => {
    render(<ChatConversationPanel />);

    expect(screen.getByText("New Task")).toBeTruthy();
    expect(screen.getByText("Codex")).toBeTruthy();
    expect(screen.getByLabelText("More actions")).toBeTruthy();
  });

  it("uses the mobile conversation header as the chat detail back entry", async () => {
    const user = userEvent.setup();
    const onBackToList = vi.fn();

    render(
      <ChatConversationPanel layoutMode="mobile" onBackToList={onBackToList} />,
    );

    await user.click(screen.getByRole("button", { name: "Chat" }));

    expect(onBackToList).toHaveBeenCalledTimes(1);
  });

  it("lets the session list owner route new mobile welcome drafts", async () => {
    const user = userEvent.setup();

    render(<ChatConversationPanel layoutMode="mobile" />);

    await user.click(
      screen.getByRole("button", { name: "create draft session" }),
    );

    expect(mocks.createSession).toHaveBeenCalledWith("native");
    expect(mocks.goToChatRoot).not.toHaveBeenCalled();
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
    expect(
      screen.queryByText("No messages yet. Send one to start."),
    ).toBeNull();
  });

  it("keeps the message list mounted while waiting for the first assistant token", () => {
    useChatThreadStore.setState({
      snapshot: {
        ...useChatThreadStore.getState().snapshot,
        sessionKey: "session-1",
        messages: [
          {
            id: "user-1",
            sessionId: "session-1",
            role: "user",
            status: "final",
            parts: [{ type: "text", text: "hello" }],
            timestamp: "2026-05-19T00:00:00.000Z",
          } as never,
        ],
        isSending: true,
        isAwaitingAssistantOutput: true,
      },
    });

    render(<ChatConversationPanel />);

    expect(screen.getByTestId("chat-message-list").dataset).toMatchObject({
      messageCount: "1",
      sending: "true",
    });
    expect(
      screen.queryByText("No messages yet. Send one to start."),
    ).toBeNull();
  });

  it("does not show assistant waiting copy before the first message is visible", () => {
    useChatThreadStore.setState({
      snapshot: {
        ...useChatThreadStore.getState().snapshot,
        sessionKey: "session-1",
        messages: [],
        isSending: true,
        isAwaitingAssistantOutput: true,
      },
    });

    render(<ChatConversationPanel />);

    expect(screen.queryByTestId("chat-message-list")).toBeNull();
    expect(
      screen.queryByText("No messages yet. Send one to start."),
    ).toBeNull();
  });

  it("does not reopen the welcome panel after a root draft send fails", () => {
    useChatThreadStore.setState({
      snapshot: {
        ...useChatThreadStore.getState().snapshot,
        sessionKey: null,
        messages: [],
        isSending: false,
        isAwaitingAssistantOutput: false,
        hasSubmittedDraftMessage: true,
      },
    });

    render(<ChatConversationPanel />);

    expect(screen.queryByTestId("chat-welcome")).toBeNull();
    expect(
      screen.queryByText("No messages yet. Send one to start."),
    ).toBeNull();
  });

  it("does not render runtime lifecycle copy in the conversation alert strip", () => {
    render(<ChatConversationPanel />);

    expect(
      screen.queryByText(
        "聊天能力正在初始化。你可以先输入内容，完成后即可发送。",
      ),
    ).toBeNull();
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
  beforeEach(resetChatConversationPanelTestState);

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
        sessionKey="parent-session-1"
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
        sessionWorkingDir="/Users/demo/project-alpha"
      />,
    );

    expect(screen.queryByText("Child sessions")).toBeNull();
    expect(screen.getByTestId("resizable-right-panel-handle")).toBeTruthy();
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
        sessionKey="parent-session-1"
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
        sessionWorkingDir="/Users/demo/project-alpha"
      />,
    );

    expect(screen.getByLabelText("Session has unread updates")).toBeTruthy();
  });

  it("shows opened files as top tabs and renders the file preview pane", () => {
    render(
      <ChatSessionWorkspacePanel
        sessionKey="parent-session-1"
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
        sessionWorkingDir="/Users/demo/project-alpha"
      />,
    );

    expect(screen.queryByText("Open files")).toBeNull();
    expect(screen.getAllByText("README.md").length).toBeGreaterThan(0);
    expect(screen.getByTestId("workspace-file-preview").textContent).toBe(
      "README.md",
    );
    expect(
      screen.getByTestId("workspace-tabs-scroll").parentElement?.className,
    ).toContain("workspace-horizontal-scrollbar");
  });

  it("uses workspace-local backward and forward history actions in the tab bar", async () => {
    const user = userEvent.setup();

    render(
      <ChatSessionWorkspacePanel
        sessionKey="parent-session-1"
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
        workspaceNavigationHistory={[
          { kind: "child-session", key: "child-session-1" },
          { kind: "file", key: "parent-session-1::preview::README.md" },
          { kind: "cron" },
        ]}
        workspaceNavigationHistoryIndex={1}
        sessionProjectRoot="/Users/demo/project-alpha"
        sessionWorkingDir="/Users/demo/project-alpha"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Back in workspace" }));
    await user.click(
      screen.getByRole("button", { name: "Forward in workspace" }),
    );

    expect(mocks.goBackWorkspacePanel).toHaveBeenCalledTimes(1);
    expect(mocks.goForwardWorkspacePanel).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Back to parent" })).toBeNull();
  });

  it("renders session cron jobs in the workspace sidebar and deletes with a neutral confirmation", async () => {
    const user = userEvent.setup();
    const job: CronJobView = {
      id: "job-1",
      name: "Follow up",
      enabled: true,
      schedule: { kind: "every", everyMs: 3600000 },
      payload: {
        kind: "agent_turn",
        message: "Continue this session later",
        sessionId: "parent-session-1",
      },
      state: {
        nextRunAt: "2026-05-15T10:00:00.000Z",
        lastRunAt: null,
        lastStatus: null,
        lastError: null,
      },
      createdAt: "2026-05-15T09:00:00.000Z",
      updatedAt: "2026-05-15T09:00:00.000Z",
      deleteAfterRun: false,
    };

    render(
      <ChatSessionWorkspacePanel
        sessionKey="parent-session-1"
        childSessionTabs={[]}
        activeChildSessionKey={null}
        workspaceFileTabs={[]}
        activeWorkspaceFileKey={null}
        activePanelKind="cron"
        sessionCronJobs={[job]}
        sessionProjectRoot="/Users/demo/project-alpha"
        sessionWorkingDir="/Users/demo/project-alpha"
      />,
    );

    expect(screen.getAllByText("Session cron jobs").length).toBeGreaterThan(0);
    expect(screen.getByText("Follow up")).toBeTruthy();
    expect(screen.getByText("Continue this session later")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("Delete cron job?")).toBeTruthy();
    await user.click(screen.getAllByRole("button", { name: "Delete" }).at(-1)!);

    expect(mocks.deleteCronJob).toHaveBeenCalledWith({ id: "job-1" });
  });
});
