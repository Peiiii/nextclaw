import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NcpEventType, type NcpAgentClientEndpoint } from '@nextclaw/ncp';
import { useNcpAgentRuntime } from '@nextclaw/ncp-react';
import { DefaultNcpAgentConversationStateManager } from '@nextclaw/ncp-toolkit';

describe('useNcpAgentRuntime backend queue submission', () => {
  it('forwards a new message while a run is active and waits for backend events to add it', async () => {
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
    const send = vi.fn(async () => ({
      assistantMessageId: null,
      runId: null,
      sessionId: 'session-1',
      userMessageId: 'user-queued',
    }));
    const client = {
      abort: vi.fn(async () => undefined),
      send,
      stop: vi.fn(async () => undefined),
      stream: vi.fn(async () => undefined),
      subscribe: vi.fn(() => () => undefined),
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
  });
});
