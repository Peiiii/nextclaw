import { createNcpAppClientFetch } from '@/components/chat/ncp/ncp-app-client-fetch';

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

describe('ncp-app-client-fetch', () => {
  beforeEach(() => {
    mocks.request.mockReset();
    mocks.openStream.mockReset();
  });

  it('routes JSON requests through appClient.request', async () => {
    mocks.request.mockResolvedValue({ stopped: true });
    const fetchImpl = createNcpAppClientFetch();

    const response = await fetchImpl('http://127.0.0.1:55667/api/ncp/agent/abort', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ sessionId: 's1' })
    });

    expect(mocks.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/api/ncp/agent/abort',
      body: { sessionId: 's1' }
    });
    expect(response.ok).toBe(true);
  });

  it('re-encodes appClient stream events as SSE frames', async () => {
    mocks.openStream.mockImplementation(({ onEvent }) => {
      onEvent({ name: 'ncp-event', payload: { type: 'message.chunk', payload: { text: 'hello' } } });
      return {
        finished: Promise.resolve(undefined),
        cancel: vi.fn()
      };
    });
    const fetchImpl = createNcpAppClientFetch();

    const response = await fetchImpl('http://127.0.0.1:55667/api/ncp/agent/stream?sessionId=s1', {
      method: 'GET',
      headers: {
        accept: 'text/event-stream'
      }
    });
    const text = await response.text();

    expect(mocks.openStream).toHaveBeenCalledWith({
      method: 'GET',
      path: '/api/ncp/agent/stream?sessionId=s1',
      signal: undefined,
      onEvent: expect.any(Function)
    });
    expect(text).toContain('event: ncp-event');
    expect(text).toContain('"text":"hello"');
  });
});
