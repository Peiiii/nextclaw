import type {
  AdminMarketplaceAppDetailPayload as BaseDetailPayload,
  AdminMarketplaceAppDetailView as BaseDetailView,
  MarketplaceAppManifestView as BaseManifestView,
} from '@/api/types';

export type AdminMarketplaceAppCatalogVisibility = 'listed' | 'unlisted';

export type MarketplaceAppManifestView = Omit<
  BaseManifestView,
  'schemaVersion' | 'main' | 'ui'
> & {
  schemaVersion: 1 | 2;
  main?: {
    kind: 'wasm';
    entry: string;
    export: string;
    action: string;
  } | {
    kind: 'wasi-http-component';
    entry: string;
  };
  ui?: { entry: string };
  engines?: { nextclaw?: string };
  presentation?: { primaryPanel?: string };
  runtime?: { profile: 'panel-only' | 'wasi' | 'native-process' };
  storage?: { scope: 'global'; schemaVersion: number };
  components?: Array<{ kind: 'panel' | 'service'; path: string }>;
};

export type AdminMarketplaceAppDetailView = Omit<BaseDetailView, 'manifest'> & {
  manifestSchemaVersion: 1 | 2;
  catalogVisibility: AdminMarketplaceAppCatalogVisibility;
  manifest: MarketplaceAppManifestView;
  publicListing: {
    eligible: boolean;
    reason: 'official-scope' | 'panel-only' | 'legacy-schema' | 'community-native-process' | 'invalid-runtime';
  };
};

export type AdminMarketplaceAppDetailPayload = Omit<BaseDetailPayload, 'item'> & {
  item: AdminMarketplaceAppDetailView;
};
