export type MarketplaceItemType = 'skill' | 'mcp';

export type MarketplaceSort = 'relevance' | 'updated';

export type MarketplaceSkillInstallKind = 'builtin' | 'marketplace';
export type MarketplaceMcpInstallKind = 'template';
export type MarketplaceInstallKind = MarketplaceSkillInstallKind | MarketplaceMcpInstallKind;

export type MarketplaceInstallSpec = {
  kind: MarketplaceInstallKind;
  spec: string;
  command: string;
};

export type MarketplaceMcpTemplateInput = {
  id: string;
  label: string;
  description?: string;
  required?: boolean;
  secret?: boolean;
  defaultValue?: string;
};

export type MarketplaceMcpInstallSpec = MarketplaceInstallSpec & {
  kind: 'template';
  defaultName: string;
  transportTypes: Array<'stdio' | 'http' | 'sse'>;
  template: Record<string, unknown>;
  inputs: MarketplaceMcpTemplateInput[];
};

export type MarketplaceLocalizedTextMap = Record<string, string>;

export type MarketplaceItemSummary = {
  id: string;
  slug: string;
  type: MarketplaceItemType;
  name: string;
  summary: string;
  summaryI18n: MarketplaceLocalizedTextMap;
  tags: string[];
  author: string;
  install: MarketplaceInstallSpec;
  updatedAt: string;
};

export type MarketplaceItemView = MarketplaceItemSummary & {
  description?: string;
  descriptionI18n?: MarketplaceLocalizedTextMap;
  sourceRepo?: string;
  homepage?: string;
  publishedAt: string;
};

export type MarketplaceSkillContentView = {
  type: 'skill';
  slug: string;
  name: string;
  install: MarketplaceInstallSpec;
  source: 'builtin' | 'marketplace' | 'remote';
  raw: string;
  metadataRaw?: string;
  bodyRaw: string;
  sourceUrl?: string;
};

export type MarketplaceMcpContentView = {
  type: 'mcp';
  slug: string;
  name: string;
  install: MarketplaceMcpInstallSpec;
  source: 'marketplace' | 'remote';
  raw: string;
  metadataRaw?: string;
  bodyRaw: string;
  sourceUrl?: string;
};

export type MarketplaceListView = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  sort: MarketplaceSort;
  query?: string;
  items: MarketplaceItemSummary[];
};

export type MarketplaceRecommendationView = {
  type: MarketplaceItemType;
  sceneId: string;
  title: string;
  description?: string;
  total: number;
  items: MarketplaceItemSummary[];
};

export type MarketplaceSceneView = {
  scene: string;
  title: string;
  description?: string;
  count?: number;
};

export type MarketplaceScenesView = {
  scenes: MarketplaceSceneView[];
};

export type MarketplaceInstalledRecord = {
  type: MarketplaceItemType;
  id?: string;
  spec: string;
  label?: string;
  description?: string;
  descriptionZh?: string;
  source?: string;
  installedAt?: string;
  enabled?: boolean;
  runtimeStatus?: string;
  origin?: string;
  installPath?: string;
  transport?: 'stdio' | 'http' | 'sse';
  scope?: {
    allAgents: boolean;
    agents: string[];
  };
  catalogSlug?: string;
  vendor?: string;
  docsUrl?: string;
  homepage?: string;
  trustLevel?: 'official' | 'verified' | 'community';
  toolCount?: number;
  accessible?: boolean;
  lastReadyAt?: string;
  lastDoctorAt?: string;
  lastError?: string;
};

export type MarketplaceInstalledView = {
  type: MarketplaceItemType;
  total: number;
  specs: string[];
  records: MarketplaceInstalledRecord[];
};

export type MarketplaceInstallRequest = {
  type: MarketplaceItemType;
  spec: string;
  kind?: MarketplaceInstallKind;
  skill?: string;
  installPath?: string;
  force?: boolean;
  name?: string;
  enabled?: boolean;
  allAgents?: boolean;
  agents?: string[];
  inputs?: Record<string, string>;
};

export type MarketplaceInstallResult = {
  type: MarketplaceItemType;
  spec: string;
  message: string;
  output?: string;
  name?: string;
};

export type MarketplaceManageAction = 'enable' | 'disable' | 'update' | 'uninstall' | 'remove';

export type MarketplaceManageRequest = {
  type: MarketplaceItemType;
  action: MarketplaceManageAction;
  id?: string;
  spec?: string;
  force?: boolean;
};

export type MarketplaceManageResult = {
  type: MarketplaceItemType;
  action: MarketplaceManageAction;
  id: string;
  message: string;
  output?: string;
};

export type MarketplaceMcpDoctorResult = {
  name: string;
  enabled: boolean;
  transport: 'stdio' | 'http' | 'sse';
  accessible: boolean;
  toolCount: number;
  error?: string;
};
