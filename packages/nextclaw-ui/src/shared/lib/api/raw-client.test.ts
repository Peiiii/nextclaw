import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestRawApiResponse } from './raw-client.utils';

const fetchMock = vi.fn<typeof fetch>();

describe('requestRawApiResponse', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('preserves original fetch failure details in synthetic network errors', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const response = await requestRawApiResponse('/api/config', {
      method: 'POST'
    });

    expect(response.ok).toBe(false);
    if (response.ok) {
      throw new Error('expected synthetic error response');
    }
    expect(response.error.code).toBe('NETWORK_ERROR');
    expect(response.error.message).toContain('Fetch failed on POST /api/config');
    expect(response.error.message).toContain('TypeError: Failed to fetch');
    expect(response.error.details).toMatchObject({
      method: 'POST',
      endpoint: '/api/config',
      errorName: 'TypeError',
      errorMessage: 'Failed to fetch'
    });
  });
});
