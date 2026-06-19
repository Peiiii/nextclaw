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

import { I18nProvider } from '@/app/components/i18n-provider';
import { ChatPresenterProvider, type ChatPresenterLike } from '@/features/chat/components/providers/chat-presenter.provider';
import {
  SessionConversationInput,
  type SessionConversationInputController,
} from '@/features/chat/features/conversation/components/session-conversation-input';
import type {
  SessionConversationInputActions,
  SessionConversationInputPatch,
  SessionConversationInputSnapshot,
} from '@/features/chat/features/conversation/hooks/use-session-conversation-input-state';

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
  },
} as unknown as ChatPresenterLike;

const controller: SessionConversationInputController = {
  canStopGeneration: true,
  isSending: true,
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
  controlRef,
}: {
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
          controller={controller}
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
});
