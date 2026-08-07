import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { UiNcpSessionQueuedInputView } from '@nextclaw/client-sdk';
import type { NcpAgentSendEnvelope, NcpMessage, NcpRunHandle } from '@nextclaw/ncp';

import { useSessionConversationController } from '@/features/chat/features/conversation/hooks/use-session-conversation-controller';

type TestAgentSend = (envelope: NcpAgentSendEnvelope) => Promise<NcpRunHandle | null>;

function createTextNode(text: string) {
  return {
    id: 'text-1',
    type: 'text' as const,
    text,
  };
}

function createRunHandle(overrides: Partial<NcpRunHandle> = {}): NcpRunHandle {
  return {
    assistantMessageId: null,
    correlationId: undefined,
    runId: 'run-1',
    sessionId: 'session-1',
    userMessageId: 'user-message-1',
    ...overrides,
  };
}

function createQueuedInput(): UiNcpSessionQueuedInputView {
  return {
    id: 'queued-input-1',
    sessionId: 'session-1',
    enqueuedAt: '2026-07-05T10:00:00.000Z',
    metadata: {},
    message: {
      id: 'user-message-queued',
      sessionId: 'session-1',
      role: 'user',
      status: 'final',
      timestamp: '2026-07-05T10:00:00.000Z',
      parts: [{ type: 'text', text: 'queued task' }],
    },
  };
}

function createSendMock(handle: NcpRunHandle | null = createRunHandle()) {
  return vi.fn<TestAgentSend>(async () => handle);
}

function createControllerParams(params: {
  isRunning: boolean;
  queuedInputs?: readonly UiNcpSessionQueuedInputView[];
  send?: ReturnType<typeof createSendMock>;
}) {
  const { isRunning, queuedInputs = [], send: requestedSend } = params;
  const send = requestedSend ?? createSendMock();
  const continueRun = vi.fn(async () => createRunHandle());
  const editMessage = vi.fn(async () => createRunHandle({ sessionId: 'edited-session' }));
  const removeQueuedInput = vi.fn(async (id: string) =>
    queuedInputs.find((item) => item.id === id) ?? null,
  );
  return {
    agent: {
      abort: vi.fn(),
      continueRun,
      editMessage,
      isHydrating: false,
      isRunning,
      isSending: false,
      send,
      snapshot: {
        activeRun: isRunning ? { sessionId: 'session-1' } : null,
      },
      visibleMessages: [],
    },
    inputQuery: {
      addDiscoveredModel: vi.fn(async () => null),
      defaultModel: 'test-model',
      defaultProjectRoot: null,
      dismissDiscoveredModels: vi.fn(),
      discoveredModelOptions: [],
      fallbackPreferredModel: undefined,
      fallbackPreferredThinking: undefined,
      isProviderStateResolved: true,
      isSkillsLoading: false,
      modelOptions: [],
      providersView: null,
      refreshProviderModelCatalog: vi.fn(),
      selectedSession: null,
      selectedSessionKey: 'session-1',
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
    },
    inputSnapshot: {
      attachments: [],
      composerFocusRequestId: 0,
      nodes: [createTextNode('next task')],
      pendingProjectRoot: null,
      pendingSessionType: 'default',
      selectedModel: undefined,
      selectedSessionType: 'default',
      selectedSkills: [],
      selectedThinkingLevel: null,
      sendError: null,
      skillRecords: [],
      text: 'next task',
    },
    isRuntimeBlocked: false,
    runQueue: {
      inputs: queuedInputs,
      removeQueuedInput,
    },
    selectedAgentId: 'main',
    sessionKey: 'session-1',
    resetComposer: vi.fn(),
    restoreComposer: vi.fn(),
    onSessionMaterialized: vi.fn(),
    setSendError: vi.fn(),
  };
}

describe('useSessionConversationController backend run queue', () => {
  it('submits immediately while the session is running so the backend can enqueue it', async () => {
    const send = createSendMock(createRunHandle({ runId: null }));
    const params = createControllerParams({ isRunning: true, send });
    const { result } = renderHook(() => useSessionConversationController(params));

    await act(async () => {
      await result.current.send();
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      sessionId: 'session-1',
      message: expect.objectContaining({
        parts: [{ type: 'text', text: 'next task' }],
      }),
    });
    expect(params.resetComposer).toHaveBeenCalledTimes(1);
  });

  it('projects the backend queue and returns a removed item to the composer for editing', async () => {
    const queuedInput = createQueuedInput();
    const params = createControllerParams({ isRunning: true, queuedInputs: [queuedInput] });
    const { result } = renderHook(() => useSessionConversationController(params));

    expect(result.current.queuedInputs).toEqual([
      { id: queuedInput.id, preview: 'queued task' },
    ]);
    act(() => {
      result.current.editQueuedInput(queuedInput.id);
    });

    await waitFor(() => expect(params.runQueue.removeQueuedInput).toHaveBeenCalledWith(queuedInput.id));
    expect(params.restoreComposer).toHaveBeenCalledWith(expect.objectContaining({
      attachments: [],
      selectedSkills: [],
      skillRecords: [],
      text: 'queued task',
    }));
  });

  it('deletes through the backend queue owner without restoring the composer', async () => {
    const queuedInput = createQueuedInput();
    const params = createControllerParams({ isRunning: true, queuedInputs: [queuedInput] });
    const { result } = renderHook(() => useSessionConversationController(params));

    act(() => {
      result.current.deleteQueuedInput(queuedInput.id);
    });

    await waitFor(() => expect(params.runQueue.removeQueuedInput).toHaveBeenCalledWith(queuedInput.id));
    expect(params.restoreComposer).not.toHaveBeenCalled();
  });

  it('continues a cancelled session from the primary action when the composer is empty', async () => {
    const params = createControllerParams({ isRunning: false });
    params.inputSnapshot.nodes = [];
    params.inputSnapshot.text = '';
    const controllerParams = {
      ...params,
      inputQuery: {
        ...params.inputQuery,
        selectedSession: { activityPreview: { state: 'cancelled' } },
      },
    } as unknown as Parameters<typeof useSessionConversationController>[0];
    const { result } = renderHook(() => useSessionConversationController(controllerParams));

    expect(result.current.primaryAction).toBe('continue');
    expect(result.current.canContinue).toBe(true);
    await act(async () => {
      await result.current.send();
    });

    expect(params.agent.continueRun).toHaveBeenCalledWith({ sessionId: 'session-1' });
    expect(params.agent.send).not.toHaveBeenCalled();
    expect(params.resetComposer).not.toHaveBeenCalled();
  });

  it('keeps continuation available but restores send as primary when the user types', () => {
    const params = createControllerParams({ isRunning: false });
    const controllerParams = {
      ...params,
      inputQuery: {
        ...params.inputQuery,
        selectedSession: { activityPreview: { state: 'failed' } },
      },
    } as unknown as Parameters<typeof useSessionConversationController>[0];
    const { result } = renderHook(() => useSessionConversationController(controllerParams));

    expect(result.current.canContinue).toBe(true);
    expect(result.current.primaryAction).toBe('send');
  });

  it('edits inside the current session without materializing or navigating to another session', async () => {
    const params = createControllerParams({ isRunning: false });
    const message = {
      id: 'edited-user-message',
      sessionId: 'session-1',
      role: 'user',
      status: 'final',
      timestamp: '2026-08-08T10:00:00.000Z',
      parts: [{ type: 'text', text: 'updated request' }],
    } satisfies NcpMessage;
    const { result } = renderHook(() => useSessionConversationController(params));

    await act(async () => {
      await result.current.editMessage({ messageId: 'user-message-1', message });
    });

    expect(params.agent.editMessage).toHaveBeenCalledWith({
      message,
      messageId: 'user-message-1',
      sessionId: 'session-1',
    });
    expect(params.onSessionMaterialized).not.toHaveBeenCalled();
  });
});
