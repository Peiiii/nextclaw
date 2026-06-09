import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('API_BASE', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('prefers explicit VITE_API_BASE when provided', async () => {
    vi.stubEnv('VITE_API_BASE', 'https://api.example.com/');
    vi.stubGlobal('window', {
      location: {
        origin: 'https://remote.claw.cool'
      }
    });

    const { API_BASE } = await import('@/shared/lib/api');

    expect(API_BASE).toBe('https://api.example.com');
  });

  it('falls back to window origin when no explicit API base is configured', async () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'https://remote.claw.cool'
      }
    });

    const { API_BASE } = await import('@/shared/lib/api');

    expect(API_BASE).toBe('https://remote.claw.cool');
  });
});
