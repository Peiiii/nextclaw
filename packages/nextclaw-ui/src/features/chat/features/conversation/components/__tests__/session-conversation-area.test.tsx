import { memo, type ReactNode } from "react";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { SessionConversationArea } from "@/features/chat/features/conversation/components/session-conversation-area";
import type { ChatDraftIntent } from "@/features/chat/managers/chat-draft-intent.manager";

const mocks = vi.hoisted(() => {
  const inputRenderSpy = vi.fn();
  const initialPromptSpy = vi.fn();
  const controllerParamsSpy = vi.fn();
  const inputActions = {
    update: vi.fn(),
    syncComposer: vi.fn(),
    resetComposer: vi.fn(),
    restoreComposer: vi.fn(),
    applyPromptSuggestion: vi.fn(),
    requestComposerFocusAtEnd: vi.fn(),
    consumeComposerFocusRequest: vi.fn(),
    setAttachments: vi.fn(),
    addAttachments: vi.fn(() => []),
    removeAttachment: vi.fn(),
    setSelectedThinkingLevel: vi.fn(),
    syncSessionPreferences: vi.fn(),
    setPendingSessionType: vi.fn(),
    setPendingProjectRoot: vi.fn(),
    setSelectedSkills: vi.fn(),
    setSendError: vi.fn(),
  };
  const inputSnapshot = {
    text: "",
    nodes: [],
    selectedSkills: [],
    skillRecords: [],
    attachments: [],
    selectedModel: undefined,
    selectedThinkingLevel: null,
    pendingSessionType: "default",
    selectedSessionType: "default",
    pendingProjectRoot: null,
    composerFocusRequestId: 0,
    sendError: null as string | null,
  };
  const inputQuery = {
    defaultModel: undefined as string | undefined,
    defaultProjectRoot: null,
    fallbackPreferredModel: undefined as string | undefined,
    fallbackPreferredThinking: null,
    isProviderStateResolved: true,
    isSkillsLoading: false,
    modelOptions: [],
    selectedSession: null as null | {
      activityPreview?: {
        state: "running" | "completed" | "failed" | "cancelled" | "idle";
        statusKind?: "run-failed" | "run-interrupted";
        statusText?: string;
        replyText?: string;
      };
      status?: string;
    },
    selectedSessionKey: null,
    sessionTypeState: {
      sessionTypeOptions: [],
      selectedSessionTypeOption: null,
      defaultSessionType: "default",
      selectedSessionType: "default",
      canEditSessionType: true,
      sessionTypeUnavailable: false,
      sessionTypeUnavailableMessage: null,
    },
    skillRecords: [],
  };
  const controller = {
    canEditQueuedInput: true,
    canStopGeneration: true,
    deleteQueuedInput: vi.fn(),
    editQueuedInput: vi.fn(),
    hasSendableDraft: true,
    isSending: true,
    queuedInputs: [],
    send: vi.fn(),
    sendSteering: vi.fn(),
    sendDisabled: true,
    stop: vi.fn(),
    stopDisabled: false,
    steerQueuedInput: vi.fn(),
  };
  const agent = {
    visibleMessages: [] as unknown[],
    isHydrating: false,
    isRunning: true,
    isSending: true,
    hydrateError: null as Error | null,
    snapshot: {
      activeRun: null,
      contextWindow: null,
      error: null as { code?: string; message: string } | null,
    },
    send: vi.fn(),
    abort: vi.fn(),
  };

  return {
    agent,
    controller,
    controllerParamsSpy,
    inputActions,
    inputQuery,
    inputRenderSpy,
    initialPromptSpy,
    inputSnapshot,
    pendingInputs: [] as unknown[],
    runtimeBlocked: false,
    presenter: {
      chatUiManager: {
        goToProviders: vi.fn(),
      },
      chatSessionListManager: {
        createSession: vi.fn(),
        setSelectedAgentId: vi.fn(),
      },
    },
    appPresenter: {
      chatDraftIntentManager: {
        consumePending: vi.fn<() => ChatDraftIntent | null>(() => null),
        markConsumed: vi.fn(),
        subscribe: vi.fn(() => vi.fn()),
      },
    },
  };
});

vi.mock("@/app/components/app-presenter-provider", () => ({
  useAppPresenter: () => mocks.appPresenter,
}));

vi.mock("@/features/chat/components/providers/chat-presenter.provider", () => ({
  usePresenter: () => mocks.presenter,
}));

vi.mock(
  "@/features/chat/components/conversation/chat-conversation-content",
  () => ({
    ChatConversationContent: ({
      bottomSlot,
      isContextCompacting,
      messageActionsDisabled,
      messages,
      showWelcome,
      welcomeSlot,
    }: {
      bottomSlot?: ReactNode;
      isContextCompacting?: boolean;
      messageActionsDisabled?: boolean;
      messages: readonly unknown[];
      showWelcome: boolean;
      welcomeSlot?: ReactNode;
    }) => (
      <div
        data-testid="conversation-content"
        data-context-compacting={String(Boolean(isContextCompacting))}
        data-message-actions-disabled={String(Boolean(messageActionsDisabled))}
        data-show-welcome={String(showWelcome)}
      >
        {showWelcome ? (
          welcomeSlot
        ) : (
          <div data-testid="message-count">{messages.length}</div>
        )}
        {bottomSlot ? (
          <div data-testid="conversation-bottom-slot">{bottomSlot}</div>
        ) : null}
      </div>
    ),
  }),
);

vi.mock(
  "@/features/chat/features/welcome/components/chat-conversation-welcome",
  () => ({
    ChatConversationWelcome: ({ inputSlot }: { inputSlot: ReactNode }) => (
      <div data-testid="welcome">{inputSlot}</div>
    ),
  }),
);

vi.mock(
  "@/features/chat/features/ncp/hooks/use-ncp-session-conversation",
  () => ({
    isNcpAgentStartupUnavailableErrorMessage: () => false,
    useNcpSessionConversation: () => mocks.agent,
  }),
);

vi.mock(
  "@/features/chat/features/conversation/hooks/use-session-run-queue",
  () => ({
    useSessionRunQueue: () => ({
      inputs: [],
      pendingInputs: mocks.pendingInputs,
      isLoading: false,
      refreshPendingInputs: vi.fn(async () => []),
      refreshQueuedInputs: vi.fn(async () => []),
      removeQueuedInput: vi.fn(async () => null),
      steerQueuedInput: vi.fn(async () => null),
    }),
  }),
);

vi.mock(
  "@/features/chat/features/runtime/utils/ncp-chat-runtime-availability.utils",
  () => ({
    isNcpChatRuntimeBlocked: () => mocks.runtimeBlocked,
    resolveNcpChatSendErrorMessage: ({ message }: { message: string | null }) =>
      message,
  }),
);

vi.mock(
  "@/features/chat/features/conversation/hooks/use-session-conversation-input-state",
  () => ({
    useSessionConversationInputState: (
      initialPrompt?: string | null,
      sessionKey?: string | null,
    ) => {
      mocks.initialPromptSpy(initialPrompt, sessionKey);
      return {
        inputActions: mocks.inputActions,
        inputSnapshot: mocks.inputSnapshot,
      };
    },
  }),
);

vi.mock(
  "@/features/chat/features/conversation/hooks/use-session-conversation-input-query",
  () => ({
    useSessionConversationInputQuery: () => mocks.inputQuery,
  }),
);

vi.mock(
  "@/features/chat/features/conversation/hooks/use-session-conversation-controller",
  () => ({
    useSessionConversationController: (params: unknown) => {
      mocks.controllerParamsSpy(params);
      return mocks.controller;
    },
  }),
);

vi.mock("@/features/chat/stores/chat-session-list.store", () => ({
  useChatSessionListStore: (
    selector: (state: { snapshot: { selectedAgentId: string } }) => unknown,
  ) => selector({ snapshot: { selectedAgentId: "main" } }),
}));

vi.mock("@/features/system-status", () => ({
  useSystemStatus: () => ({ phase: "ready", lastReadyAt: 1 }),
}));

vi.mock("../session-conversation-input", () => ({
  SessionConversationInput: memo((props: unknown) => {
    mocks.inputRenderSpy(props);
    return <div data-testid="conversation-input" />;
  }),
}));

function renderArea(sessionKey: string | null = "session-1") {
  return render(
    <MemoryRouter>
      <SessionConversationArea sessionKey={sessionKey} />
    </MemoryRouter>,
  );
}

describe("SessionConversationArea input boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.agent.visibleMessages = [];
    mocks.pendingInputs = [];
    mocks.agent.isHydrating = false;
    mocks.agent.isRunning = true;
    mocks.agent.isSending = true;
    mocks.agent.hydrateError = null;
    mocks.agent.snapshot.contextWindow = null;
    mocks.agent.snapshot.error = null;
    mocks.controller.isSending = true;
    mocks.runtimeBlocked = false;
    mocks.inputSnapshot.sendError = null;
    mocks.inputQuery.defaultModel = undefined;
    mocks.inputQuery.fallbackPreferredModel = undefined;
    mocks.inputQuery.selectedSession = null;
    mocks.inputQuery.sessionTypeState.selectedSessionType = "default";
  });

  it("passes running state without treating an active run as a send request in flight", () => {
    mocks.agent.isRunning = true;
    mocks.agent.isSending = false;

    renderArea("session-1");

    expect(mocks.controllerParamsSpy).toHaveBeenCalled();
    const params = mocks.controllerParamsSpy.mock.calls[0]?.[0] as {
      agent: { isRunning: boolean; isSending: boolean };
    };
    expect(params.agent.isRunning).toBe(true);
    expect(params.agent.isSending).toBe(false);
  });

  it("disables message recovery actions until the NCP agent is ready", () => {
    mocks.agent.isRunning = false;
    mocks.agent.isSending = false;
    mocks.controller.isSending = false;
    mocks.runtimeBlocked = true;

    const rendered = renderArea("session-1");

    expect(
      screen.getByTestId("conversation-content").dataset.messageActionsDisabled,
    ).toBe("true");

    mocks.runtimeBlocked = false;
    rendered.rerender(
      <MemoryRouter>
        <SessionConversationArea sessionKey="session-1" />
      </MemoryRouter>,
    );

    expect(
      screen.getByTestId("conversation-content").dataset.messageActionsDisabled,
    ).toBe("false");
  });

  it("keeps the composer input subtree stable when only streamed messages change", () => {
    const rendered = renderArea("session-1");

    expect(mocks.inputRenderSpy).toHaveBeenCalledOnce();

    mocks.agent.visibleMessages = [{ id: "message-1" }];
    rendered.rerender(
      <MemoryRouter>
        <SessionConversationArea sessionKey="session-1" />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("message-count").textContent).toBe("1");
    expect(mocks.inputRenderSpy).toHaveBeenCalledOnce();
  });

  it("projects a steering input as one pending user message until its durable message arrives", () => {
    const message = {
      id: "steering-message-1",
      sessionId: "session-1",
      role: "user",
      status: "final",
      timestamp: "2026-08-22T00:00:00.000Z",
      parts: [{ type: "text", text: "改变方向" }],
    };
    mocks.pendingInputs = [{
      id: "pending-input-1",
      intendedRunId: "run-1",
      placement: "steering",
      message,
    }];
    const rendered = renderArea("session-1");

    expect(screen.getByTestId("message-count").textContent).toBe("1");

    mocks.agent.visibleMessages = [message];
    rendered.rerender(
      <MemoryRouter>
        <SessionConversationArea sessionKey="session-1" />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("message-count").textContent).toBe("1");
  });

  it("shows compaction feedback only for the active session", () => {
    renderArea("session-1");
    const inputProps = mocks.inputRenderSpy.mock.calls[0]?.[0] as {
      onContextCompactingChange: (sessionId: string, isCompacting: boolean) => void;
    };

    act(() => inputProps.onContextCompactingChange("session-1", true));

    expect(screen.getByTestId("conversation-content").dataset.contextCompacting)
      .toBe("true");

    act(() => inputProps.onContextCompactingChange("session-1", false));

    expect(screen.getByTestId("conversation-content").dataset.contextCompacting)
      .toBe("false");
  });

  it("leaves the welcome surface on the first local sending render", () => {
    mocks.agent.isRunning = false;
    mocks.agent.isSending = false;
    mocks.controller.isSending = false;
    const rendered = renderArea(null);

    expect(screen.getByTestId("conversation-content").dataset.showWelcome).toBe(
      "true",
    );

    mocks.controller.isSending = true;
    rendered.rerender(
      <MemoryRouter>
        <SessionConversationArea sessionKey={null} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("conversation-content").dataset.showWelcome).toBe(
      "false",
    );
    expect(screen.queryByTestId("welcome")).toBeNull();
    expect(screen.getByTestId("conversation-input")).toBeTruthy();
  });

  it("hydrates an initial prompt from draft route state", () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/chat/draft",
            state: {
              chatDraft: {
                sessionType: "native",
                projectRoot: null,
                prompt: "每天整理项目风险",
              },
            },
          },
        ]}
      >
        <SessionConversationArea sessionKey={null} />
      </MemoryRouter>,
    );

    expect(mocks.initialPromptSpy).toHaveBeenCalledWith(
      "每天整理项目风险",
      null,
    );
    expect(mocks.inputActions.applyPromptSuggestion).toHaveBeenCalledWith(
      "每天整理项目风险",
    );
  });

  it("consumes a system object draft intent as a visible composer token", () => {
    const reference = {
      uri: "nextclaw://objects/inbox-delivery/delivery-1",
      objectType: "inbox-delivery",
      objectId: "delivery-1",
      label: "OOM investigation report",
      description: "Root cause and mitigation",
      updatedAt: "2026-08-11T00:00:00.000Z",
      version: "sha256-report",
      assetUri: "asset://store/report",
      fileName: "oom-investigation-report.md",
      mimeType: "text/markdown",
      sizeBytes: 128,
    };
    mocks.appPresenter.chatDraftIntentManager.consumePending.mockReturnValueOnce({
      id: 1,
      kind: "system-object-reference",
      reference,
    });

    render(
      <MemoryRouter>
        <SessionConversationArea
          consumeDraftIntent
          sessionKey={null}
        />
      </MemoryRouter>,
    );

    expect(mocks.presenter.chatSessionListManager.createSession).toHaveBeenCalledOnce();
    expect(mocks.appPresenter.chatDraftIntentManager.markConsumed).toHaveBeenCalledWith(1);
    const update = mocks.inputActions.update.mock.calls.at(-1)?.[0] as (
      current: { nodes: []; text: string },
    ) => { nodes: Array<Record<string, unknown>>; text: string };
    const next = update({ nodes: [], text: "" });
    expect(next.nodes).toEqual([
      expect.objectContaining({
        type: "token",
        tokenKind: "system_object",
        tokenKey: reference.uri,
        label: reference.label,
        data: { reference },
      }),
    ]);
    expect(next.text).toBe("");
  });

  it("syncs draft preferences with the selected runtime context", () => {
    mocks.inputQuery.defaultModel = "openai/gpt-5";
    mocks.inputQuery.fallbackPreferredModel = "minimax/MiniMax-M3";
    const rendered = renderArea(null);
    mocks.inputActions.syncSessionPreferences.mockClear();

    mocks.inputQuery.sessionTypeState.selectedSessionType = "codex";
    rendered.rerender(
      <MemoryRouter>
        <SessionConversationArea sessionKey={null} />
      </MemoryRouter>,
    );

    expect(mocks.inputActions.syncSessionPreferences).toHaveBeenCalledOnce();
    expect(mocks.inputActions.syncSessionPreferences).toHaveBeenLastCalledWith(
      expect.objectContaining({
        defaultModel: "openai/gpt-5",
        fallbackPreferredModel: "minimax/MiniMax-M3",
        selectedSessionKey: null,
        selectedSessionType: "codex",
      }),
    );
  });

  it("surfaces selected-session failure previews at the conversation bottom", () => {
    mocks.inputQuery.selectedSession = {
      activityPreview: {
        state: "failed",
        statusText: "Invalid API Key",
      },
      status: "idle",
    };

    renderArea("session-1");

    expect(screen.getByTestId("conversation-bottom-slot")).toBeTruthy();
    expect(screen.getByText("Invalid API Key")).toBeTruthy();
  });

  it("renders overlapping runtime failures once with a subdued diagnostic surface", () => {
    const providerError = `Chat Completions API failed (402): {\n  "error": "${"x".repeat(240)} END_OF_PROVIDER_ERROR"\n}`;
    mocks.inputSnapshot.sendError = providerError;
    mocks.agent.snapshot.error = { message: providerError };
    mocks.inputQuery.selectedSession = {
      activityPreview: {
        state: "failed",
        statusText: providerError,
      },
      status: "idle",
    };

    renderArea("session-1");

    expect(screen.getAllByRole("status")).toHaveLength(1);
    const failureStatus = screen.getByRole("status");
    expect(failureStatus.className).toContain("bg-muted/45");
    expect(failureStatus.className).not.toContain("bg-red");
    const errorDetail = failureStatus.querySelector("pre");
    expect(errorDetail?.className).toContain("max-h-32");
    expect(errorDetail?.className).toContain("overflow-auto");
    expect(errorDetail?.textContent).toBe(providerError);
  });

  it("does not surface user-cancelled previews as conversation errors", () => {
    mocks.inputQuery.selectedSession = {
      activityPreview: {
        state: "cancelled",
        statusText: "Run interrupted: User stopped the current run.",
      },
      status: "idle",
    };

    renderArea("session-1");

    expect(screen.queryByTestId("conversation-bottom-slot")).toBeNull();
    expect(screen.queryByText(/出错了|Something went wrong/)).toBeNull();
  });

  it("does not expose recovered runtime interruption diagnostics as task errors", () => {
    const recoveryDetail = "Run interrupted: internal recovery detail.";
    mocks.agent.snapshot.error = {
      code: "run-interrupted",
      message: recoveryDetail,
    };
    mocks.inputQuery.selectedSession = {
      activityPreview: {
        state: "failed",
        statusKind: "run-interrupted",
        statusText: recoveryDetail,
      },
      status: "idle",
    };

    renderArea("session-1");

    expect(screen.queryByTestId("conversation-bottom-slot")).toBeNull();
    expect(screen.queryByText(recoveryDetail)).toBeNull();
  });
});
