import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNcpAppClientFetch } from '@/features/chat/utils/ncp-app-client-fetch.utils';

const fetchMock = vi.fn<typeof fetch>();

describe('ncp-app-client-fetch', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps native fetch semantics and only injects credentials', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'content-type': 'application/json'
      }
    }));
    const fetchImpl = createNcpAppClientFetch();

    const response = await fetchImpl('http://127.0.0.1:55667/api/ncp/agent/abort', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ sessionId: 's1' })
    });

    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:55667/api/ncp/agent/abort', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ sessionId: 's1' }),
      credentials: 'include'
    });
    expect(response.ok).toBe(true);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('does not synthesize fake HTTP 500 responses for fetch failures', async () => {
    fetchMock.mockRejectedValue(new Error('Failed to fetch'));
    const fetchImpl = createNcpAppClientFetch();

    await expect(fetchImpl('http://127.0.0.1:55667/api/ncp/agent/abort', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ sessionId: 's1' })
    })).rejects.toThrow('NCP fetch failed for POST http://127.0.0.1:55667/api/ncp/agent/abort: Error: Failed to fetch');
  });

  it('preserves native SSE request headers', async () => {
    fetchMock.mockResolvedValue(new Response('event: ncp-event\ndata: {"ok":true}\n\n', {
      status: 200,
      headers: {
        'content-type': 'text/event-stream'
      }
    }));
    const fetchImpl = createNcpAppClientFetch();

    const response = await fetchImpl('http://127.0.0.1:55667/api/ncp/agent/stream?sessionId=s1', {
      method: 'GET',
      headers: {
        accept: 'text/event-stream'
      }
    });

    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:55667/api/ncp/agent/stream?sessionId=s1', {
      method: 'GET',
      headers: {
        accept: 'text/event-stream'
      },
      credentials: 'include'
    });
    expect(await response.text()).toContain('event: ncp-event');
  });
});
