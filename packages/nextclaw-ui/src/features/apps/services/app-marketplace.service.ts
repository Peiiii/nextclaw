import type {
  AppMarketplaceCatalogParams,
  AppMarketplaceCatalogView,
  AppMarketplaceDetailView,
  AppMarketplaceItemView,
} from '@/features/apps/types/app-marketplace.types';

const APP_MARKETPLACE_BASE_URL = 'https://apps-registry.nextclaw.io';
const UNSUPPORTED_CATALOG_STATUSES = new Set([404, 405, 501]);
const EXPLICIT_DEV_PREVIEW_COVER_BASE_URL = import.meta.env
  .VITE_APP_MARKETPLACE_PREVIEW_COVER_BASE_URL?.replace(/\/$/, '');
const DEFAULT_DEV_PREVIEW_COVER_BASE_URL = import.meta.env.DEV && !import.meta.env.VITEST
  ? '/__app-marketplace-preview'
  : undefined;
const DEV_PREVIEW_COVERS = new Set([
  'hello-notes',
  'personal-organizer',
  'starter-card',
  'workspace-glance',
]);

type AppMarketplaceRequestParams = AppMarketplaceCatalogParams & {
  cursor?: string;
  limit?: number;
};

export async function fetchAppMarketplace(
  params: AppMarketplaceRequestParams = {},
  signal?: AbortSignal,
): Promise<AppMarketplaceCatalogView> {
  const response = await fetchAppMarketplaceV2(params, signal);
  if (UNSUPPORTED_CATALOG_STATUSES.has(response.status)) {
    return await fetchLegacyAppMarketplace(params, signal);
  }
  return await readAppMarketplaceCatalogResponse(response);
}

export async function fetchAppMarketplaceDetail(
  slug: string,
  signal?: AbortSignal,
): Promise<AppMarketplaceDetailView> {
  const response = await fetch(
    `${APP_MARKETPLACE_BASE_URL}/api/v1/apps/items/${encodeURIComponent(slug)}`,
    { headers: { accept: 'application/json' }, signal },
  );
  if (!response.ok) {
    throw new Error(`Marketplace detail request failed (${response.status})`);
  }
  const payload: unknown = await response.json();
  if (!isRecord(payload) || payload.ok !== true || !isRecord(payload.data)) {
    throw new Error('Marketplace returned an invalid app detail');
  }
  const { data: item } = payload;
  const rawDetail = item as Record<string, unknown>;
  if (!isAppMarketplaceItem(item) || !isRecord(rawDetail.manifest) || !isRecord(rawDetail.permissions)) {
    throw new Error('Marketplace returned an invalid app detail');
  }
  const { manifest, permissions } = rawDetail;
  const components = Array.isArray(manifest.components)
    ? manifest.components.filter((component: unknown): component is { kind: 'panel' | 'service'; path: string } =>
        isRecord(component)
        && (component.kind === 'panel' || component.kind === 'service')
        && typeof component.path === 'string')
    : undefined;
  return {
    ...withDevPreviewCover(item),
    description: typeof rawDetail.description === 'string' ? rawDetail.description : undefined,
    descriptionI18n: isStringRecord(rawDetail.descriptionI18n) ? rawDetail.descriptionI18n : undefined,
    manifest: {
      schemaVersion: manifest.schemaVersion === 2 ? 2 : 1,
      icon: typeof manifest.icon === 'string' ? manifest.icon : undefined,
      engines: isRecord(manifest.engines) && typeof manifest.engines.nextclaw === 'string'
        ? { nextclaw: manifest.engines.nextclaw }
        : undefined,
      components,
    },
    permissions: permissions as AppMarketplaceDetailView['permissions'],
  };
}

export function withDevPreviewCover<T extends AppMarketplaceItemView>(item: T): T {
  if (item.coverUrl) {
    return item;
  }
  const previewCoverUrl = readDevPreviewCoverUrl(item.slug);
  if (item.publisher.id !== 'nextclaw' || !previewCoverUrl) {
    return item;
  }
  return {
    ...item,
    coverUrl: previewCoverUrl,
    coverPreview: true,
  };
}

async function fetchAppMarketplaceV2(
  params: AppMarketplaceRequestParams,
  signal?: AbortSignal,
): Promise<Response> {
  const { cursor, featured, limit, publisher, q, sort, tag, tags } = params;
  const search = new URLSearchParams();
  if (q) search.set('q', q);
  if (tag) search.set('tag', tag);
  if (tags?.length) search.set('tags', tags.join(','));
  if (publisher) search.set('publisher', publisher);
  if (featured !== undefined) search.set('featured', String(featured));
  if (sort) search.set('sort', sort);
  if (cursor) search.set('cursor', cursor);
  search.set('limit', String(limit ?? 24));
  return await fetch(`${APP_MARKETPLACE_BASE_URL}/api/v2/apps/items?${search}`, {
    headers: { accept: 'application/json' },
    signal,
  });
}

async function readAppMarketplaceCatalogResponse(
  response: Response,
): Promise<AppMarketplaceCatalogView> {
  if (!response.ok) {
    throw new Error(`Marketplace request failed (${response.status})`);
  }

  const payload: unknown = await response.json();
  if (!isRecord(payload) || payload.ok !== true || !isRecord(payload.data)) {
    throw new Error('Marketplace returned an invalid response');
  }

  const items = Array.isArray(payload.data.items)
    ? payload.data.items.filter(isAppMarketplaceItem)
    : [];
  return {
    items: items.map(withDevPreviewCover),
    nextCursor: typeof payload.data.nextCursor === 'string' ? payload.data.nextCursor : undefined,
    hasMore: payload.data.hasMore === true,
    query: typeof payload.data.query === 'string' ? payload.data.query : undefined,
    tag: typeof payload.data.tag === 'string' ? payload.data.tag : undefined,
    featured: typeof payload.data.featured === 'boolean' ? payload.data.featured : undefined,
    sort: payload.data.sort === 'updated' || payload.data.sort === 'featured'
      ? payload.data.sort
      : 'relevance',
  };
}

async function fetchLegacyAppMarketplace(
  params: AppMarketplaceRequestParams,
  signal?: AbortSignal,
): Promise<AppMarketplaceCatalogView> {
  const { featured, publisher, q, sort, tag, tags } = params;
  const search = new URLSearchParams({ page: '1', pageSize: '100' });
  if (q) search.set('q', q);
  if (tag) search.set('tag', tag);
  const response = await fetch(`${APP_MARKETPLACE_BASE_URL}/api/v1/apps/items?${search}`, {
    headers: { accept: 'application/json' },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Marketplace compatibility request failed (${response.status})`);
  }
  const payload: unknown = await response.json();
  if (!isRecord(payload) || payload.ok !== true || !isRecord(payload.data)) {
    throw new Error('Marketplace returned an invalid compatibility response');
  }

  const items = Array.isArray(payload.data.items)
    ? payload.data.items.filter(isAppMarketplaceItem)
    : [];
  const requiredTags = new Set(tags ?? []);
  return {
    items: items
      .filter((item) => !publisher || item.publisher.id === publisher)
      .filter((item) => featured === undefined || item.featured === featured)
      .filter((item) => requiredTags.size === 0 || item.tags.some((tag) => requiredTags.has(tag)))
      .map(withDevPreviewCover),
    hasMore: false,
    query: q,
    tag,
    tags,
    featured,
    sort: sort ?? (q ? 'relevance' : 'featured'),
  };
}

function readDevPreviewCoverUrl(slug: string): string | undefined {
  const baseUrl = EXPLICIT_DEV_PREVIEW_COVER_BASE_URL ?? DEFAULT_DEV_PREVIEW_COVER_BASE_URL;
  if (baseUrl && DEV_PREVIEW_COVERS.has(slug)) {
    return `${baseUrl}/${encodeURIComponent(slug)}.webp`;
  }
  return undefined;
}

function isAppMarketplaceItem(value: unknown): value is AppMarketplaceItemView {
  if (!isRecord(value) || !isRecord(value.install) || !isRecord(value.publisher)) {
    return false;
  }
  return typeof value.id === 'string'
    && typeof value.slug === 'string'
    && typeof value.appId === 'string'
    && typeof value.name === 'string'
    && (value.iconUrl === undefined || typeof value.iconUrl === 'string')
    && (value.coverUrl === undefined || typeof value.coverUrl === 'string')
    && (value.coverPreview === undefined || typeof value.coverPreview === 'boolean')
    && (value.accentColor === undefined || typeof value.accentColor === 'string')
    && typeof value.summary === 'string'
    && isStringRecord(value.summaryI18n)
    && Array.isArray(value.tags)
    && value.tags.every((tag) => typeof tag === 'string')
    && typeof value.latestVersion === 'string'
    && typeof value.featured === 'boolean'
    && typeof value.publisher.id === 'string'
    && typeof value.publisher.name === 'string'
    && value.install.kind === 'registry'
    && typeof value.install.spec === 'string'
    && typeof value.install.registry === 'string'
    && typeof value.webUrl === 'string';
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
