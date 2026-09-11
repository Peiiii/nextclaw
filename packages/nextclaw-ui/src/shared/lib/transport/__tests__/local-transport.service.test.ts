import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalAppTransport } from '@/shared/lib/transport/local-transport.service';

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor(public readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  send = vi.fn();

  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
  });

  open = (): void => {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.({} as Event);
  };

  finishClose = (): void => {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({} as CloseEvent);
  };
}

describe('LocalAppTransport browser connection recovery', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('replaces a possibly stale open socket when a mobile page becomes visible again', () => {
    let visibilityState: DocumentVisibilityState = 'hidden';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibilityState);

    const transport = new LocalAppTransport({ apiBase: 'https://vps.example.com' });
    const handler = vi.fn();
    const unsubscribe = transport.subscribe(handler);
    const staleSocket = MockWebSocket.instances[0];
    staleSocket?.open();

    visibilityState = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('online'));

    expect(staleSocket?.close).toHaveBeenCalledTimes(1);
    expect(MockWebSocket.instances).toHaveLength(2);
    expect(handler).toHaveBeenCalledWith({ type: 'connection.close', payload: {} });

    const replacementSocket = MockWebSocket.instances[1];
    replacementSocket?.open();
    staleSocket?.finishClose();

    expect(MockWebSocket.instances).toHaveLength(2);
    expect(handler).toHaveBeenLastCalledWith({ type: 'connection.open', payload: {} });
    vi.advanceTimersByTime(250);
    window.dispatchEvent(new Event('online'));
    const secondReplacement = MockWebSocket.instances[2];
    secondReplacement?.open();
    replacementSocket?.finishClose();
    const event = { type: 'session.updated', payload: { sessionKey: 'after-second-recovery' } };
    secondReplacement?.onmessage?.({ data: JSON.stringify(event) } as MessageEvent);
    expect(handler).toHaveBeenLastCalledWith(event);
    expect(MockWebSocket.instances).toHaveLength(3);
    unsubscribe();
    window.dispatchEvent(new Event('online'));
    expect(MockWebSocket.instances).toHaveLength(3);
  });

  it('replaces a frozen connecting socket when the page regains focus', () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    const transport = new LocalAppTransport({ apiBase: 'https://vps.example.com' });
    const handler = vi.fn();
    const unsubscribe = transport.subscribe(handler);
    const frozenSocket = MockWebSocket.instances[0];

    window.dispatchEvent(new Event('focus'));

    expect(frozenSocket?.close).toHaveBeenCalledTimes(1);
    expect(MockWebSocket.instances).toHaveLength(2);
    expect(handler).toHaveBeenCalledWith({ type: 'connection.close', payload: {} });
    MockWebSocket.instances[1]?.open();
    expect(handler).toHaveBeenLastCalledWith({ type: 'connection.open', payload: {} });
    unsubscribe();
  });
});
