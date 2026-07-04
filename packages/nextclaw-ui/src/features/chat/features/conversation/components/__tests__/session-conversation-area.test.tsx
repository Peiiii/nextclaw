import { memo, type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { SessionConversationArea } from '@/features/chat/features/conversation/components/session-conversation-area';

const mocks = vi.hoisted(() => {
  const inputRenderSpy = vi.fn();
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
    setSelectedModel: vi.fn(),
    setSelectedThinkingLevel: vi.fn(),
    setPendingSessionType: vi.fn(),
    setPendingProjectRoot: vi.fn(),
    setSelectedSkills: vi.fn(),
    setSendError: vi.fn(),
  };
  const inputSnapshot = {
    text: '',
    nodes: [],
    selectedSkills: [],
    skillRecords: [],
    attachments: [],
    selectedModel: undefined,
    selectedThinkingLevel: null,
    pendingSessionType: 'default',
    selectedSessionType: 'default',
    pendingProjectRoot: null,
    composerFocusRequestId: 0,
    sendError: null,
  };
  const inputQuery = {
    defaultModel: undefined,
    defaultProjectRoot: null,
    fallbackPreferredModel: undefined,
    fallbackPreferredThinking: null,
    isProviderStateResolved: true,
    isSkillsLoading: false,
    modelOptions: [],
    selectedSession: null as null | {
      activityPreview?: {
        state: 'running' | 'completed' | 'failed' | 'idle';
        statusText?: string;
        replyText?: string;
      };
      status?: string;
    },
    selectedSessionKey: null,
    sessionTypeState: {
      sessionTypeOptions: [],
      selectedSessionTypeOption: null,
      defaultSessionType: 'default',
      selectedSessionType: 'default',
      canEditSessionType: true,
      sessionTypeUnavailable: false,
      sessionTypeUnavailableMessage: null,
    },
    skillRecords: [],
  };
  const controller = {
    canStopGeneration: true,
    deleteQueuedInput: vi.fn(),
    editQueuedInput: vi.fn(),
    hasSendableDraft: true,
    isSending: true,
    queuedInputs: [],
    send: vi.fn(),
    sendDisabled: true,
    stop: vi.fn(),
    stopDisabled: false,
  };
  const agent = {
    visibleMessages: [] as unknown[],
    isHydrating: false,
    isRunning: true,
    isSending: true,
    hydrateError: null,
    snapshot: {
      activeRun: null,
      contextWindow: null,
      error: null,
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
    inputSnapshot,
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
        consumePending: vi.fn(() => null),
        markConsumed: vi.fn(),
        subscribe: vi.fn(() => vi.fn()),
      },
    },
  };
});

vi.mock('@/app/components/app-presenter-provider', () => ({
  useAppPresenter: () => mocks.appPresenter,
}));

vi.mock('@/features/chat/components/providers/chat-presenter.provider', () => ({
  usePresenter: () => mocks.presenter,
}));

vi.mock('@/features/chat/components/conversation/chat-conversation-content', () => ({
  ChatConversationContent: ({
    bottomSlot,
    messages,
    showWelcome,
    welcomeSlot,
  }: {
    bottomSlot?: ReactNode;
    messages: readonly unknown[];
    showWelcome: boolean;
    welcomeSlot?: ReactNode;
  }) => (
    <div data-testid="conversation-content" data-show-welcome={String(showWelcome)}>
      {showWelcome ? welcomeSlot : <div data-testid="message-count">{messages.length}</div>}
      {bottomSlot ? <div data-testid="conversation-bottom-slot">{bottomSlot}</div> : null}
    </div>
  ),
}));

vi.mock('@/features/chat/features/welcome/components/chat-conversation-welcome', () => ({
  ChatConversationWelcome: ({ inputSlot }: { inputSlot: ReactNode }) => (
    <div data-testid="welcome">{inputSlot}</div>
  ),
}));

vi.mock('@/features/chat/features/ncp/hooks/use-ncp-session-conversation', () => ({
  isNcpAgentStartupUnavailableErrorMessage: () => false,
  useNcpSessionConversation: () => mocks.agent,
}));

vi.mock('@/features/chat/features/runtime/utils/ncp-chat-runtime-availability.utils', () => ({
  isNcpChatRuntimeBlocked: () => false,
  resolveNcpChatSendErrorMessage: ({ message }: { message: string | null }) => message,
}));

vi.mock('@/features/chat/features/conversation/hooks/use-session-conversation-input-state', () => ({
  useSessionConversationInputState: () => ({
    inputActions: mocks.inputActions,
    inputSnapshot: mocks.inputSnapshot,
  }),
}));

vi.mock('@/features/chat/features/conversation/hooks/use-session-conversation-input-query', () => ({
  useSessionConversationInputQuery: () => mocks.inputQuery,
}));

vi.mock('@/features/chat/features/conversation/hooks/use-session-conversation-controller', () => ({
  useSessionConversationController: (params: unknown) => {
    mocks.controllerParamsSpy(params);
    return mocks.controller;
  },
}));

vi.mock('@/features/chat/stores/chat-session-list.store', () => ({
  useChatSessionListStore: (selector: (state: { snapshot: { selectedAgentId: string } }) => unknown) =>
    selector({ snapshot: { selectedAgentId: 'main' } }),
}));

vi.mock('@/features/system-status', () => ({
  useSystemStatus: () => ({ phase: 'ready', lastReadyAt: 1 }),
}));

vi.mock('../session-conversation-input', () => ({
  SessionConversationInput: memo((props: unknown) => {
    mocks.inputRenderSpy(props);
    return <div data-testid="conversation-input" />;
  }),
}));

function renderArea(sessionKey: string | null = 'session-1') {
  return render(
    <MemoryRouter>
      <SessionConversationArea sessionKey={sessionKey} />
    </MemoryRouter>,
  );
}

describe('SessionConversationArea input boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.agent.visibleMessages = [];
    mocks.agent.isHydrating = false;
    mocks.agent.isRunning = true;
    mocks.agent.isSending = true;
    mocks.agent.snapshot.contextWindow = null;
    mocks.inputQuery.selectedSession = null;
  });

  it('passes running state without treating an active run as a send request in flight', () => {
    mocks.agent.isRunning = true;
    mocks.agent.isSending = false;

    renderArea('session-1');

    expect(mocks.controllerParamsSpy).toHaveBeenCalled();
    const params = mocks.controllerParamsSpy.mock.calls[0]?.[0] as {
      agent: { isRunning: boolean; isSending: boolean };
    };
    expect(params.agent.isRunning).toBe(true);
    expect(params.agent.isSending).toBe(false);
  });

  it('keeps the composer input subtree stable when only streamed messages change', () => {
    const rendered = renderArea('session-1');

    expect(mocks.inputRenderSpy).toHaveBeenCalledOnce();

    mocks.agent.visibleMessages = [{ id: 'message-1' }];
    rendered.rerender(
      <MemoryRouter>
        <SessionConversationArea sessionKey="session-1" />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('message-count').textContent).toBe('1');
    expect(mocks.inputRenderSpy).toHaveBeenCalledOnce();
  });

  it('does not replace the welcome composer just because draft send starts', () => {
    renderArea(null);

    expect(screen.getByTestId('conversation-content').dataset.showWelcome).toBe('true');
    expect(screen.getByTestId('welcome')).toBeTruthy();
    expect(screen.getByTestId('conversation-input')).toBeTruthy();
  });

  it('surfaces selected-session failure previews at the conversation bottom', () => {
    mocks.inputQuery.selectedSession = {
      activityPreview: {
        state: 'failed',
        statusText: '运行出错：Invalid API Key',
      },
      status: 'idle',
    };

    renderArea('session-1');

    expect(screen.getByTestId('conversation-bottom-slot')).toBeTruthy();
    expect(screen.getByText(/出错了|Something went wrong/)).toBeTruthy();
    expect(screen.getByText('运行出错：Invalid API Key')).toBeTruthy();
  });
});
