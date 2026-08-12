import type { AppMarketplaceItemView } from './use-app-marketplace';
import { afterEach, describe, expect, it, vi } from 'vitest';

const app: AppMarketplaceItemView = {
  id: 'app-personal-organizer',
  slug: 'personal-organizer',
  appId: 'nextclaw.personal-organizer',
  name: '个人空间',
  summary: 'A calm personal space.',
  summaryI18n: { en: 'A calm personal space.' },
  tags: ['personal'],
  latestVersion: '0.1.1',
  featured: true,
  publisher: { id: 'nextclaw', name: 'NextClaw' },
  install: {
    kind: 'registry' as const,
    spec: 'nextclaw.personal-organizer',
    registry: 'https://apps-registry.nextclaw.io/api/v1/apps/registry/',
  },
  webUrl: 'https://apps.nextclaw.io/apps/personal-organizer',
};

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('withDevPreviewCover', () => {
  it('uses an explicitly configured preview cover for a known official app', async () => {
    vi.stubEnv('VITE_APP_MARKETPLACE_PREVIEW_COVER_BASE_URL', 'http://127.0.0.1:4178/covers/');
    const { withDevPreviewCover } = await import('./use-app-marketplace');

    expect(withDevPreviewCover(app).coverUrl).toBe(
      'http://127.0.0.1:4178/covers/personal-organizer.webp',
    );
    expect(withDevPreviewCover(app).coverPreview).toBe(true);
  });

  it('keeps a Registry cover as the canonical source', async () => {
    vi.stubEnv('VITE_APP_MARKETPLACE_PREVIEW_COVER_BASE_URL', 'http://127.0.0.1:4178/covers');
    const { withDevPreviewCover } = await import('./use-app-marketplace');
    const registryCover = 'https://apps-registry.nextclaw.io/cover.webp';

    expect(withDevPreviewCover({ ...app, coverUrl: registryCover }).coverUrl).toBe(registryCover);
    expect(withDevPreviewCover({ ...app, coverUrl: registryCover }).coverPreview).toBeUndefined();
  });

  it('does not guess preview assets for third-party apps', async () => {
    vi.stubEnv('VITE_APP_MARKETPLACE_PREVIEW_COVER_BASE_URL', 'http://127.0.0.1:4178/covers');
    const { withDevPreviewCover } = await import('./use-app-marketplace');

    expect(withDevPreviewCover({
      ...app,
      publisher: { id: 'third-party', name: 'Third Party' },
    }).coverUrl).toBeUndefined();
  });
});

describe('fetchAppMarketplace', () => {
  it('uses the cursor catalog endpoint and preserves pagination metadata', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({
      ok: true,
      data: {
        items: [app],
        hasMore: true,
        nextCursor: 'cursor-2',
        query: 'notes',
        tag: 'personal',
        sort: 'relevance',
      },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { fetchAppMarketplace } = await import('./use-app-marketplace');

    await expect(fetchAppMarketplace({
      q: 'notes',
      tag: 'personal',
      cursor: 'cursor-1',
      limit: 24,
    })).resolves.toMatchObject({
      hasMore: true,
      nextCursor: 'cursor-2',
      items: [app],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v2/apps/items?'),
      expect.any(Object),
    );
    const requestUrl = fetchMock.mock.calls[0]?.[0];
    expect(requestUrl).toBeTypeOf('string');
    const url = new URL(String(requestUrl));
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      q: 'notes',
      tag: 'personal',
      cursor: 'cursor-1',
      limit: '24',
    });
  });

  it('uses the legacy catalog only when the server explicitly does not support v2', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        data: { items: [app], page: 1, pageSize: 100, total: 1, totalPages: 1 },
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { fetchAppMarketplace } = await import('./use-app-marketplace');

    await expect(fetchAppMarketplace({ tags: ['personal'], limit: 24 })).resolves.toMatchObject({
      hasMore: false,
      items: [app],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toContain('/api/v1/apps/items?');
  });

  it('does not hide a v2 server failure behind the compatibility path', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    const { fetchAppMarketplace } = await import('./use-app-marketplace');

    await expect(fetchAppMarketplace()).rejects.toThrow('Marketplace request failed (500)');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('forwards cancellation through both v2 and its explicit compatibility request', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        data: { items: [app], page: 1, pageSize: 100, total: 1, totalPages: 1 },
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { fetchAppMarketplace } = await import('./use-app-marketplace');

    await fetchAppMarketplace({}, controller.signal);

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ signal: controller.signal });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ signal: controller.signal });
  });
});
