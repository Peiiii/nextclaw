import { api, requestApiResponse } from '@/shared/lib/api';

const mocks = vi.hoisted(() => ({
  request: vi.fn()
}));

vi.mock('@/shared/lib/transport', () => ({
  appClient: {
    request: mocks.request
  }
}));

describe('api/client', () => {
  beforeEach(() => {
    mocks.request.mockReset();
  });

  it('routes GET requests through appClient.request', async () => {
    mocks.request.mockResolvedValue({ ok: true });

    const response = await api.get<{ ok: boolean }>('/api/config');

    expect(mocks.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/api/config'
    });
    expect(response).toEqual({
      ok: true,
      data: { ok: true }
    });
  });

  it('forwards timeout overrides to appClient.request', async () => {
    mocks.request.mockResolvedValue({ ok: true });

    await api.get<{ ok: boolean }>('/api/auth/status', { timeoutMs: 5000 });

    expect(mocks.request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/api/auth/status',
      timeoutMs: 5000
    });
  });

  it('parses JSON request bodies before sending to appClient.request', async () => {
    mocks.request.mockResolvedValue({ success: true });

    const response = await requestApiResponse<{ success: boolean }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password: 'secret' })
    });

    expect(mocks.request).toHaveBeenCalledWith({
      method: 'POST',
      path: '/api/auth/login',
      body: { password: 'secret' }
    });
    expect(response).toEqual({
      ok: true,
      data: { success: true }
    });
  });

  it('wraps transport failures as ApiResponse errors', async () => {
    mocks.request.mockRejectedValue(new Error('Invalid token'));

    const response = await api.get('/api/auth/status');

    expect(response).toEqual({
      ok: false,
      error: {
        code: 'REQUEST_FAILED',
        message: 'Invalid token',
        details: {
          method: 'GET',
          endpoint: '/api/auth/status'
        }
      }
    });
  });
});
