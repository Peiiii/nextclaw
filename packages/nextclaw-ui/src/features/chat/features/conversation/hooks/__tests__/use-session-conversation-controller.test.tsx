import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NcpAgentSendEnvelope, NcpRunHandle } from '@nextclaw/ncp';

import { useSessionConversationController } from '@/features/chat/features/conversation/hooks/use-session-conversation-controller';

type TestAgentSendEnvelope = NcpAgentSendEnvelope;
type TestAgentSend = (envelope: TestAgentSendEnvelope) => Promise<NcpRunHandle | null>;

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

function createSendMock() {
  return vi.fn<TestAgentSend>(async () => createRunHandle());
}

function createAgent(params: {
  isRunning: boolean;
  send: ReturnType<typeof createSendMock>;
}) {
  return {
    abort: vi.fn(),
    isHydrating: false,
    isRunning: params.isRunning,
    isSending: false,
    send: params.send,
    snapshot: {
      activeRun: params.isRunning ? { sessionId: 'session-1' } : null,
    },
    visibleMessages: [],
  };
}

function createControllerParams(params: {
  isRunning: boolean;
  send?: ReturnType<typeof createSendMock>;
}) {
  const send = params.send ?? createSendMock();
  return {
    agent: createAgent({ isRunning: params.isRunning, send }),
    inputQuery: {
      defaultModel: 'test-model',
      defaultProjectRoot: null,
      fallbackPreferredModel: undefined,
      fallbackPreferredThinking: undefined,
      isProviderStateResolved: true,
      isSkillsLoading: false,
      modelOptions: [],
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
    selectedAgentId: 'main',
    sessionKey: 'session-1',
    resetComposer: vi.fn(),
    restoreComposer: vi.fn(),
    setSendError: vi.fn(),
  };
}

describe('useSessionConversationController queued input delivery', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('queues a draft while the agent is running and sends it when the run becomes idle', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-05T10:00:00.000Z'));
    const send = createSendMock();
    const { result, rerender } = renderHook(
      ({ isRunning }) => useSessionConversationController(createControllerParams({ isRunning, send })),
      { initialProps: { isRunning: true } },
    );

    await act(async () => {
      await result.current.send();
    });

    expect(send).not.toHaveBeenCalled();
    expect(result.current.queuedInputs).toEqual([{ id: expect.any(String), preview: 'next task' }]);

    vi.setSystemTime(new Date('2026-07-05T10:01:00.000Z'));
    rerender({ isRunning: false });

    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      message: expect.objectContaining({
        parts: [{ type: 'text', text: 'next task' }],
        timestamp: '2026-07-05T10:01:00.000Z',
      }),
      sessionId: 'session-1',
    });
    expect(send.mock.calls[0]?.[0]).not.toHaveProperty('runDelivery');
  });

  it('returns a queued draft to the composer for editing and cancels its queue entry', async () => {
    const send = createSendMock();
    const params = createControllerParams({ isRunning: true, send });
    const { result } = renderHook(() => useSessionConversationController(params));

    await act(async () => {
      await result.current.send();
    });
    const queuedId = result.current.queuedInputs[0]?.id;
    expect(queuedId).toBeTruthy();

    act(() => {
      result.current.editQueuedInput(queuedId ?? '');
    });

    expect(result.current.queuedInputs).toEqual([]);
    expect(params.restoreComposer).toHaveBeenCalledWith({
      attachments: [],
      nodes: [createTextNode('next task')],
      selectedSkills: [],
      skillRecords: [],
      text: 'next task',
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('deletes a queued draft without restoring it to the composer', async () => {
    const send = createSendMock();
    const params = createControllerParams({ isRunning: true, send });
    const { result } = renderHook(() => useSessionConversationController(params));

    await act(async () => {
      await result.current.send();
    });
    const queuedId = result.current.queuedInputs[0]?.id;
    expect(queuedId).toBeTruthy();

    act(() => {
      result.current.deleteQueuedInput(queuedId ?? '');
    });

    expect(result.current.queuedInputs).toEqual([]);
    expect(params.restoreComposer).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});
