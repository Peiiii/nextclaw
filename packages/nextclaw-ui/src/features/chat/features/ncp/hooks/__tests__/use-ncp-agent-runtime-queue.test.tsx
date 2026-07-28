import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  NcpEventType,
  type NcpAgentClientEndpoint,
  type NcpAgentSendEnvelope,
  type NcpEndpointSubscriber,
  type NcpMessage,
} from '@nextclaw/ncp';
import { useNcpAgentRuntime } from '@nextclaw/ncp-react';
import { DefaultNcpAgentConversationStateManager } from '@nextclaw/ncp-toolkit';

describe('useNcpAgentRuntime backend queue submission', () => {
  it('keeps a queued message out of the conversation until the backend starts it', async () => {
    const manager = new DefaultNcpAgentConversationStateManager();
    manager.hydrate({ sessionId: 'session-1', messages: [] });
    await manager.dispatch({
      type: NcpEventType.RunStarted,
      payload: {
        sessionId: 'session-1',
        runId: 'run-1',
        messageId: 'assistant-1',
      },
    });
    const send = vi.fn(async (envelope: NcpAgentSendEnvelope) => ({
      assistantMessageId: null,
      runId: null,
      sessionId: 'session-1',
      userMessageId: envelope.message.id,
    }));
    let subscriber: NcpEndpointSubscriber | null = null;
    const client = {
      abort: vi.fn(async () => undefined),
      send,
      stop: vi.fn(async () => undefined),
      stream: vi.fn(async () => undefined),
      subscribe: vi.fn((listener: NcpEndpointSubscriber) => {
        subscriber = listener;
        return () => undefined;
      }),
    } as unknown as NcpAgentClientEndpoint;
    const { result } = renderHook(() => useNcpAgentRuntime({
      client,
      manager,
      sessionId: 'session-1',
    }));

    expect(result.current.isRunning).toBe(true);
    await act(async () => {
      await result.current.send('queue this');
    });

    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'session-1',
      message: expect.objectContaining({
        parts: [{ type: 'text', text: 'queue this' }],
      }),
    }));
    expect(result.current.visibleMessages).toEqual([]);

    const queuedMessage = send.mock.calls[0][0].message as NcpMessage;
    await act(async () => {
      subscriber?.({
        type: NcpEventType.MessageSent,
        payload: {
          sessionId: 'session-1',
          message: queuedMessage,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.visibleMessages).toEqual([queuedMessage]);
    });
  });
});
