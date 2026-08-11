import { useQuery } from '@tanstack/react-query';

const APP_MARKETPLACE_QUERY_KEY = ['app-marketplace'] as const;
const APP_MARKETPLACE_BASE_URL = 'https://apps-registry.nextclaw.io';

export type AppMarketplaceItemView = {
  id: string;
  slug: string;
  appId: string;
  name: string;
  summary: string;
  summaryI18n: Record<string, string>;
  tags: string[];
  latestVersion: string;
  featured: boolean;
  publisher: {
    id: string;
    name: string;
    url?: string;
  };
  install: {
    kind: 'registry';
    spec: string;
    registry: string;
  };
  webUrl: string;
};

export type AppMarketplaceListView = {
  total: number;
  items: AppMarketplaceItemView[];
};

export function useAppMarketplace(enabled: boolean) {
  return useQuery({
    queryKey: APP_MARKETPLACE_QUERY_KEY,
    queryFn: fetchAppMarketplace,
    enabled,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });
}

async function fetchAppMarketplace(): Promise<AppMarketplaceListView> {
  const response = await fetch(
    `${APP_MARKETPLACE_BASE_URL}/api/v1/apps/items?page=1&pageSize=100`,
    { headers: { accept: 'application/json' } },
  );
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
    total: typeof payload.data.total === 'number' ? payload.data.total : items.length,
    items,
  };
}

function isAppMarketplaceItem(value: unknown): value is AppMarketplaceItemView {
  if (!isRecord(value) || !isRecord(value.install) || !isRecord(value.publisher)) {
    return false;
  }
  return typeof value.id === 'string'
    && typeof value.slug === 'string'
    && typeof value.appId === 'string'
    && typeof value.name === 'string'
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
