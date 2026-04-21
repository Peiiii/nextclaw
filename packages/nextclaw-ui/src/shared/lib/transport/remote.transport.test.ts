import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RemoteSessionMultiplexTransport } from './remote-transport.service';

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readonly sent: string[] = [];
  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor(public readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  send = (data: string): void => {
    this.sent.push(data);
  }

  close = (): void => {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({} as CloseEvent);
  }

  open = (): void => {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.({} as Event);
  }

  receive = (frame: unknown): void => {
    this.onmessage?.({
      data: JSON.stringify(frame)
    } as MessageEvent);
  }

  static reset(): void {
    MockWebSocket.instances = [];
  }
}

function lastSentRequestFrame(socket: MockWebSocket): { type: 'request'; id: string } {
  const raw = socket.sent[socket.sent.length - 1];
  if (!raw) {
    throw new Error('Expected a sent request frame.');
  }
  return JSON.parse(raw) as { type: 'request'; id: string };
}

describe('RemoteSessionMultiplexTransport request path', () => {
  beforeEach(() => {
    MockWebSocket.reset();
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('keeps ordinary requests on the remote websocket multiplex channel', async () => {
    const transport = new RemoteSessionMultiplexTransport({
      mode: 'remote',
      protocolVersion: 1,
      wsPath: '/_remote/ws'
    }, 'https://remote.claw.cool');

    const requestPromise = transport.request<{ sessions: unknown[]; total: number }>({
      method: 'GET',
      path: '/api/sessions'
    });

    const socket = MockWebSocket.instances[0];
    if (!socket) {
      throw new Error('Expected remote websocket to be created.');
    }
    socket.open();
    await Promise.resolve();
    await Promise.resolve();

    const requestFrame = lastSentRequestFrame(socket);
    socket.receive({
      type: 'response',
      id: requestFrame.id,
      status: 200,
      body: {
        ok: true,
        data: {
          sessions: [],
          total: 0
        }
      }
    });

    await expect(requestPromise).resolves.toEqual({
      sessions: [],
      total: 0
    });
    expect(socket.url).toBe('wss://remote.claw.cool/_remote/ws');
  });

  it('fails predictably when a remote request frame never receives a response', async () => {
    const transport = new RemoteSessionMultiplexTransport({
      mode: 'remote',
      protocolVersion: 1,
      wsPath: '/_remote/ws'
    }, 'https://remote.claw.cool');

    const requestPromise = transport.request({
      method: 'GET',
      path: '/api/sessions'
    });
    const timeoutExpectation = expect(requestPromise).rejects.toThrow(
      'Timed out waiting for remote request response after 15000ms: GET /api/sessions'
    );

    const socket = MockWebSocket.instances[0];
    if (!socket) {
      throw new Error('Expected remote websocket to be created.');
    }
    socket.open();
    await Promise.resolve();
    await Promise.resolve();

    await vi.advanceTimersByTimeAsync(15_000);

    await timeoutExpectation;
  });
});
