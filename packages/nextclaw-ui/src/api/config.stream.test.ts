import { sendChatTurnStream, streamChatRun } from '@/api/config';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  openStream: vi.fn()
}));

vi.mock('@/transport', () => ({
  appClient: {
    request: mocks.request,
    openStream: mocks.openStream
  }
}));

describe('api/config stream routing', () => {
  beforeEach(() => {
    mocks.request.mockReset();
    mocks.openStream.mockReset();
  });

  it('routes sendChatTurnStream through appClient.openStream', async () => {
    const onReady = vi.fn();
    const onDelta = vi.fn();
    const onSessionEvent = vi.fn();

    mocks.openStream.mockImplementation(({ onEvent }) => {
      onEvent({ name: 'ready', payload: { sessionKey: 's1' } });
      onEvent({ name: 'delta', payload: { delta: 'hello' } });
      onEvent({ name: 'session_event', payload: { type: 'session.updated' } });
      onEvent({ name: 'final', payload: { sessionKey: 's1', reply: 'hello world' } });
      return {
        finished: Promise.resolve({ sessionKey: 's1', reply: 'hello world' }),
        cancel: vi.fn()
      };
    });

    const result = await sendChatTurnStream(
      { message: 'hi' } as never,
      { onReady, onDelta, onSessionEvent }
    );

    expect(mocks.openStream).toHaveBeenCalledWith({
      method: 'POST',
      path: '/api/chat/turn/stream',
      body: { message: 'hi' },
      signal: undefined,
      onEvent: expect.any(Function)
    });
    expect(onReady).toHaveBeenCalledWith({ sessionKey: 's1' });
    expect(onDelta).toHaveBeenCalledWith({ delta: 'hello' });
    expect(onSessionEvent).toHaveBeenCalledWith({ data: { type: 'session.updated' } });
    expect(result).toEqual({ sessionKey: 's1', reply: 'hello world' });
  });

  it('routes streamChatRun through appClient.openStream and preserves query params', async () => {
    const onReady = vi.fn();
    const onDelta = vi.fn();
    const onSessionEvent = vi.fn();

    mocks.openStream.mockImplementation(() => ({
      finished: Promise.resolve({ sessionKey: 's1', reply: 'resumed' }),
      cancel: vi.fn()
    }));

    const result = await streamChatRun(
      { runId: 'run-1', fromEventIndex: 42 },
      { onReady, onDelta, onSessionEvent }
    );

    expect(mocks.openStream).toHaveBeenCalledWith({
      method: 'GET',
      path: '/api/chat/runs/run-1/stream?fromEventIndex=42',
      signal: undefined,
      onEvent: expect.any(Function)
    });
    expect(onReady).not.toHaveBeenCalled();
    expect(onDelta).not.toHaveBeenCalled();
    expect(onSessionEvent).not.toHaveBeenCalled();
    expect(result).toEqual({ sessionKey: 's1', reply: 'resumed' });
  });

  it('surfaces transport error events as rejected stream promises', async () => {
    mocks.openStream.mockImplementation(({ onEvent }) => {
      let resolveFinished!: () => void;
      let rejectFinished!: (error: Error) => void;
      const finished = new Promise<void>((resolve, reject) => {
        resolveFinished = resolve;
        rejectFinished = reject;
      });
      queueMicrotask(() => {
        try {
          onEvent({ name: 'error', payload: { message: 'chat stream failed' } });
          resolveFinished();
        } catch (error) {
          rejectFinished(error instanceof Error ? error : new Error(String(error)));
        }
      });
      return {
        finished,
        cancel: vi.fn()
      };
    });

    await expect(
      sendChatTurnStream(
        { message: 'hi' } as never,
        {
          onReady: vi.fn(),
          onDelta: vi.fn(),
          onSessionEvent: vi.fn()
        }
      )
    ).rejects.toThrow('chat stream failed');
  });
});
