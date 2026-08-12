export type AppMarketplaceItemView = {
  id: string;
  slug: string;
  appId: string;
  name: string;
  iconUrl?: string;
  coverUrl?: string;
  coverPreview?: boolean;
  accentColor?: string;
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

export type AppMarketplaceCatalogView = {
  items: AppMarketplaceItemView[];
  nextCursor?: string;
  hasMore: boolean;
  query?: string;
  tag?: string;
  tags?: string[];
  featured?: boolean;
  sort: 'relevance' | 'featured' | 'updated';
};

export type AppMarketplaceListView = {
  items: AppMarketplaceItemView[];
  hasMore: boolean;
};

export type AppMarketplaceDetailView = AppMarketplaceItemView & {
  description?: string;
  descriptionI18n?: Record<string, string>;
  manifest: {
    schemaVersion: 1 | 2;
    icon?: string;
    engines?: { nextclaw?: string };
    components?: Array<{
      kind: 'panel' | 'service';
      path: string;
    }>;
  };
  permissions: {
    documentAccess?: Array<{
      id: string;
      mode: string;
      description?: string;
    }>;
    allowedDomains?: string[];
    storage?: { namespace?: string };
    capabilities?: { hostBridge?: boolean };
  };
};

export type AppMarketplaceCatalogParams = {
  q?: string;
  tag?: string;
  tags?: string[];
  featured?: boolean;
  publisher?: string;
  sort?: 'relevance' | 'featured' | 'updated';
};
