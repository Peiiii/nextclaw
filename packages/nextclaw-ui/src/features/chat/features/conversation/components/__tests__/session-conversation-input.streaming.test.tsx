import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MutableRefObject,
} from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  createChatComposerTextNode,
  type ChatComposerNode,
} from '@nextclaw/agent-chat-ui';
import type { NcpAgentSendEnvelope, NcpRunHandle } from '@nextclaw/ncp';

import { I18nProvider } from '@/app/components/i18n-provider';
import { ChatPresenterProvider, type ChatPresenterLike } from '@/features/chat/components/providers/chat-presenter.provider';
import {
  SessionConversationInput,
  type SessionConversationInputController,
} from '@/features/chat/features/conversation/components/session-conversation-input';
import { useSessionConversationController } from '@/features/chat/features/conversation/hooks/use-session-conversation-controller';
import type {
  SessionConversationInputActions,
  SessionConversationInputPatch,
  SessionConversationInputSnapshot,
} from '@/features/chat/features/conversation/hooks/use-session-conversation-input-state';
import { useSessionConversationInputState } from '@/features/chat/features/conversation/hooks/use-session-conversation-input-state';

const uploadNcpAssetsMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/hooks/use-viewport-layout', () => ({
  useViewportLayout: () => ({ isDesktop: true, isMobile: false }),
}));

vi.mock('@/features/panel-apps', () => ({
  usePanelApps: () => ({
    data: { entries: [] },
    isFetching: false,
    isLoading: false,
  }),
}));

vi.mock('@/features/chat/features/input/hooks/use-chat-model-favorites', () => ({
  useChatModelFavorites: () => ({
    favoriteModelValues: [],
    isLoading: false,
    setModelFavorite: vi.fn(),
  }),
}));

vi.mock('@/shared/lib/api', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    updateNcpSession: vi.fn(),
    uploadNcpAssets: uploadNcpAssetsMock,
  };
});

type StreamingInputControl = {
  bumpStream: () => void;
};

const presenter = {
  chatThreadManager: {
    openSideChatDraft: vi.fn(),
  },
  chatUiManager: {
    goToProviders: vi.fn(),
    showContent: vi.fn(),
  },
} as unknown as ChatPresenterLike;

const controller: SessionConversationInputController = {
  canStopGeneration: true,
  deleteQueuedInput: vi.fn(),
  editQueuedInput: vi.fn(),
  isSending: true,
  queuedInputs: [],
  send: vi.fn(),
  sendDisabled: true,
  stop: vi.fn(),
  stopDisabled: false,
};

function createStreamingInputSnapshot(
  nodes: readonly ChatComposerNode[],
): SessionConversationInputSnapshot {
  return {
    attachments: [],
    composerFocusRequestId: 0,
    nodes,
    pendingProjectRoot: null,
    pendingSessionType: 'default',
    selectedModel: undefined,
    selectedSessionType: 'default',
    selectedSkills: [],
    selectedThinkingLevel: null,
    sendError: null,
    skillRecords: [],
    text: nodes
      .map((node) => (node.type === 'text' ? node.text : ''))
      .join(''),
  };
}

function StreamingSessionConversationInputHarness({
  controllerOverride = controller,
  controlRef,
}: {
  controllerOverride?: SessionConversationInputController;
  controlRef: MutableRefObject<StreamingInputControl | null>;
}) {
  const [nodes, setNodes] = useState<readonly ChatComposerNode[]>([
    createChatComposerTextNode(''),
  ]);
  const [streamChunk, setStreamChunk] = useState(0);
  const bumpStream = useCallback(() => setStreamChunk((chunk) => chunk + 1), []);

  useEffect(() => {
    controlRef.current = { bumpStream };
    return () => {
      controlRef.current = null;
    };
  }, [bumpStream, controlRef]);

  const inputSnapshot = useMemo(() => createStreamingInputSnapshot(nodes), [nodes]);
  const inputActions: SessionConversationInputActions = useMemo(() => ({
    addAttachments: vi.fn(() => []),
    applyPromptSuggestion: vi.fn(),
    consumeComposerFocusRequest: vi.fn(),
    removeAttachment: vi.fn(),
    requestComposerFocusAtEnd: vi.fn(),
    resetComposer: vi.fn(),
    restoreComposer: vi.fn(),
    setAttachments: vi.fn(),
    setPendingProjectRoot: vi.fn(),
    setPendingSessionType: vi.fn(),
    setSelectedModel: vi.fn(),
    setSelectedSkills: vi.fn(),
    setSelectedThinkingLevel: vi.fn(),
    setSendError: vi.fn(),
    syncComposer: vi.fn(),
    update: (patch: SessionConversationInputPatch) => {
      setNodes((currentNodes) => {
        const resolvedPatch = typeof patch === 'function'
          ? patch(createStreamingInputSnapshot(currentNodes))
          : patch;
        return resolvedPatch.nodes ?? currentNodes;
      });
    },
  }), []);
  const inputQuery = useMemo(() => ({
    defaultModel: undefined,
    defaultProjectRoot: null,
    fallbackPreferredModel: undefined,
    fallbackPreferredThinking: undefined,
    isProviderStateResolved: true,
    isSkillsLoading: false,
    modelOptions: [],
    selectedSession: null,
    selectedSessionKey: null,
    sessionTypeState: {
      canEditSessionType: true,
      defaultSessionType: 'default',
      selectedSessionType: 'default',
      selectedSessionTypeOption: null,
      sessionTypeOptions: [],
      sessionTypeUnavailable: false,
      sessionTypeUnavailableMessage: null,
    },
    skillRecords: [],
  }), []);

  return (
    <I18nProvider>
      <ChatPresenterProvider presenter={presenter}>
        <div data-testid="stream-chunk">{streamChunk}</div>
        <SessionConversationInput
          contextWindow={null}
          controller={controllerOverride}
          inputActions={inputActions}
          inputQuery={inputQuery}
          inputSnapshot={inputSnapshot}
        />
      </ChatPresenterProvider>
    </I18nProvider>
  );
}

describe('SessionConversationInput streaming stability', () => {
  it('keeps IME composition stable while simulated streamed output rerenders the owner', async () => {
    const controlRef: MutableRefObject<StreamingInputControl | null> = { current: null };
    render(<StreamingSessionConversationInputHarness controlRef={controlRef} />);

    const textbox = screen.getByRole('textbox');
    fireEvent.focus(textbox);
    fireEvent.compositionStart(textbox);

    act(() => {
      controlRef.current?.bumpStream();
      controlRef.current?.bumpStream();
    });
    expect(screen.getByTestId('stream-chunk').textContent).toBe('2');

    fireEvent.compositionEnd(textbox, { data: '你' });

    await waitFor(() => expect(textbox.textContent).toBe('你'));
  });

  it('renders queued inputs above the composer with edit and delete actions', () => {
    const controlRef: MutableRefObject<StreamingInputControl | null> = { current: null };
    const deleteQueuedInput = vi.fn();
    const editQueuedInput = vi.fn();
    render(
      <StreamingSessionConversationInputHarness
        controlRef={controlRef}
        controllerOverride={{
          ...controller,
          deleteQueuedInput,
          editQueuedInput,
          queuedInputs: [
            { id: 'queued-1', preview: '先做 A' },
            { id: 'queued-2', preview: '再做 B' },
          ],
        }}
      />,
    );

    expect(screen.getByText('先做 A')).toBeTruthy();
    expect(screen.getByText('再做 B')).toBeTruthy();
    const inputShell = document.querySelector('.nextclaw-chat-input-bar-shell');
    expect(inputShell?.contains(screen.getByText('先做 A'))).toBe(true);
    expect(inputShell?.contains(screen.getByText('再做 B'))).toBe(true);

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit queued input' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete queued input' })[1]);

    expect(editQueuedInput).toHaveBeenCalledWith('queued-1');
    expect(deleteQueuedInput).toHaveBeenCalledWith('queued-2');
  });
});

type AttachmentSubmitAgentSend = (envelope: NcpAgentSendEnvelope) => Promise<NcpRunHandle | null>;

function createAttachmentRunHandle(): NcpRunHandle {
  return {
    assistantMessageId: null,
    correlationId: undefined,
    runId: 'run-attachment',
    sessionId: 'session-attachment',
    userMessageId: 'user-message-attachment',
  };
}

function AttachmentSubmitHarness({ send }: { readonly send: AttachmentSubmitAgentSend }) {
  const { inputActions, inputSnapshot } = useSessionConversationInputState();
  const inputQuery = useMemo(() => ({
    defaultModel: 'test-model',
    defaultProjectRoot: null,
    fallbackPreferredModel: undefined,
    fallbackPreferredThinking: undefined,
    isProviderStateResolved: true,
    isSkillsLoading: false,
    modelOptions: [
      {
        value: 'test-model',
        modelLabel: 'Test Model',
        providerLabel: 'Test',
        thinkingCapability: null,
      },
    ],
    selectedSession: null,
    selectedSessionKey: 'session-attachment',
    sessionTypeState: {
      canEditSessionType: true,
      defaultSessionType: 'default',
      selectedSessionType: 'default',
      selectedSessionTypeOption: null,
      sessionTypeOptions: [],
      sessionTypeUnavailable: false,
      sessionTypeUnavailableMessage: null,
    },
    skillRecords: [],
  }), []);
  const agent = useMemo(() => ({
    abort: vi.fn(),
    isHydrating: false,
    isRunning: false,
    isSending: false,
    send,
    snapshot: {
      activeRun: null,
    },
    visibleMessages: [],
  }), [send]);
  const controller = useSessionConversationController({
    agent,
    inputSnapshot,
    inputQuery,
    isRuntimeBlocked: false,
    selectedAgentId: 'main',
    sessionKey: 'session-attachment',
    resetComposer: inputActions.resetComposer,
    restoreComposer: inputActions.restoreComposer,
    setSendError: inputActions.setSendError,
  });

  return (
    <I18nProvider>
      <ChatPresenterProvider presenter={presenter}>
        <SessionConversationInput
          contextWindow={null}
          controller={controller}
          inputActions={inputActions}
          inputQuery={inputQuery}
          inputSnapshot={inputSnapshot}
        />
      </ChatPresenterProvider>
    </I18nProvider>
  );
}

describe('SessionConversationInput attachment submit', () => {
  it('keeps uploaded file attachments in the outgoing send envelope after token insertion', async () => {
    uploadNcpAssetsMock.mockResolvedValueOnce([
      {
        id: 'uploaded-image',
        name: 'sample.png',
        mimeType: 'image/png',
        sizeBytes: 11,
        assetUri: 'asset://store/sample.png',
        url: '/api/ncp/assets/content?uri=asset%3A%2F%2Fstore%2Fsample.png',
      },
    ]);
    const send = vi.fn<AttachmentSubmitAgentSend>(async () => createAttachmentRunHandle());

    render(<AttachmentSubmitHarness send={send} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).toBeTruthy();
    await act(async () => {
      fireEvent.change(fileInput!, {
        target: {
          files: [new File(['image-bytes'], 'sample.png', { type: 'image/png' })],
        },
      });
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByText('sample.png')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /Send|发送/ }));

    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send.mock.calls[0]?.[0].message.parts).toEqual([
      {
        type: 'file',
        name: 'sample.png',
        mimeType: 'image/png',
        assetUri: 'asset://store/sample.png',
        url: '/api/ncp/assets/content?uri=asset%3A%2F%2Fstore%2Fsample.png',
        sizeBytes: 11,
      },
    ]);
  });
});
