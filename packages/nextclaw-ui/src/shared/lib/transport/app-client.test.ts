import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('appClient runtime detection', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('imports without triggering an API_BASE initialization cycle', async () => {
    const { appClient } = await import('./app-client.service');

    expect(appClient).toBeDefined();
  });

  it('falls back to LocalAppTransport when runtime probe returns html', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('<html>ui shell</html>', {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8'
        }
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const localRequest = vi.fn().mockResolvedValue({ ok: true } as never);
    vi.doMock('./local-transport.service', () => ({
      LocalAppTransport: class {
        request = localRequest;
        openStream = vi.fn();
        subscribe = vi.fn();
      }
    }));

    const { appClient } = await import('./app-client.service');
    const result = await appClient.request<{ ok: boolean }>({
      method: 'GET',
      path: '/api/config'
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/_remote/runtime'),
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
        cache: 'no-store'
      })
    );
    expect(localRequest).toHaveBeenCalledWith({
      method: 'GET',
      path: '/api/config'
    });
    expect(result).toEqual({ ok: true });
  });
});
