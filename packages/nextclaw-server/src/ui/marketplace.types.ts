export type MarketplaceItemType = "plugin" | "skill" | "mcp";

export type MarketplaceSort = "relevance" | "updated";

export type MarketplacePluginInstallKind = "npm";
export type MarketplaceSkillInstallKind = "builtin" | "marketplace";
export type MarketplaceMcpInstallKind = "template";
export type MarketplaceInstallKind =
  | MarketplacePluginInstallKind
  | MarketplaceSkillInstallKind
  | MarketplaceMcpInstallKind;

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
  kind: "template";
  defaultName: string;
  transportTypes: Array<"stdio" | "http" | "sse">;
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
  type: "skill";
  slug: string;
  name: string;
  install: MarketplaceInstallSpec;
  source: "builtin" | "marketplace" | "remote";
  raw: string;
  metadataRaw?: string;
  bodyRaw: string;
  sourceUrl?: string;
};

export type MarketplacePluginContentView = {
  type: "plugin";
  slug: string;
  name: string;
  install: MarketplaceInstallSpec;
  source: "npm" | "repo" | "remote";
  raw?: string;
  bodyRaw?: string;
  metadataRaw?: string;
  sourceUrl?: string;
};

export type MarketplaceMcpContentView = {
  type: "mcp";
  slug: string;
  name: string;
  install: MarketplaceMcpInstallSpec;
  source: "marketplace" | "remote";
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
  transport?: "stdio" | "http" | "sse";
  scope?: {
    allAgents: boolean;
    agents: string[];
  };
  catalogSlug?: string;
  vendor?: string;
  docsUrl?: string;
  homepage?: string;
  trustLevel?: "official" | "verified" | "community";
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

export type MarketplaceInstallSkillParams = {
  slug: string;
  kind?: MarketplaceSkillInstallKind;
  skill?: string;
  installPath?: string;
  force?: boolean;
};

export type MarketplacePluginInstallRequest = {
  type?: "plugin";
  spec: string;
};

export type MarketplaceSkillInstallRequest = {
  type?: "skill";
  spec: string;
  kind?: MarketplaceSkillInstallKind;
  skill?: string;
  installPath?: string;
  force?: boolean;
};

export type MarketplaceMcpInstallRequest = {
  type?: "mcp";
  spec: string;
  name?: string;
  enabled?: boolean;
  allAgents?: boolean;
  agents?: string[];
  inputs?: Record<string, string>;
  template?: MarketplaceMcpInstallSpec;
};

export type MarketplaceInstallRequest =
  | MarketplacePluginInstallRequest
  | MarketplaceSkillInstallRequest
  | MarketplaceMcpInstallRequest;

export type MarketplacePluginInstallResult = {
  type: "plugin";
  spec: string;
  message: string;
  output?: string;
};

export type MarketplaceSkillInstallResult = {
  type: "skill";
  spec: string;
  message: string;
  output?: string;
};

export type MarketplaceMcpInstallResult = {
  type: "mcp";
  spec: string;
  name: string;
  message: string;
  output?: string;
};

export type MarketplaceInstallResult =
  | MarketplacePluginInstallResult
  | MarketplaceSkillInstallResult
  | MarketplaceMcpInstallResult;

export type MarketplacePluginManageAction = "enable" | "disable" | "uninstall";
export type MarketplaceSkillManageAction = "uninstall";
export type MarketplaceMcpManageAction = "enable" | "disable" | "remove";

export type MarketplaceManageAction =
  | MarketplacePluginManageAction
  | MarketplaceSkillManageAction
  | MarketplaceMcpManageAction;

export type MarketplacePluginManageRequest = {
  type?: "plugin";
  action: MarketplacePluginManageAction;
  id?: string;
  spec?: string;
};

export type MarketplaceSkillManageRequest = {
  type?: "skill";
  action: MarketplaceSkillManageAction;
  id?: string;
  spec?: string;
};

export type MarketplaceMcpManageRequest = {
  type?: "mcp";
  action: MarketplaceMcpManageAction;
  id?: string;
  spec?: string;
};

export type MarketplaceManageRequest =
  | MarketplacePluginManageRequest
  | MarketplaceSkillManageRequest
  | MarketplaceMcpManageRequest;

export type MarketplacePluginManageResult = {
  type: "plugin";
  action: MarketplacePluginManageAction;
  id: string;
  message: string;
  output?: string;
};

export type MarketplaceSkillManageResult = {
  type: "skill";
  action: MarketplaceSkillManageAction;
  id: string;
  message: string;
  output?: string;
};

export type MarketplaceMcpManageResult = {
  type: "mcp";
  action: MarketplaceMcpManageAction;
  id: string;
  message: string;
  output?: string;
};

export type MarketplaceManageResult =
  | MarketplacePluginManageResult
  | MarketplaceSkillManageResult
  | MarketplaceMcpManageResult;

export type MarketplaceMcpDoctorResult = {
  name: string;
  enabled: boolean;
  transport: "stdio" | "http" | "sse";
  accessible: boolean;
  toolCount: number;
  error?: string;
};

export type MarketplaceInstaller = {
  installPlugin?: (spec: string) => Promise<{ message: string; output?: string }>;
  installSkill?: (params: MarketplaceInstallSkillParams) => Promise<{ message: string; output?: string }>;
  enablePlugin?: (id: string) => Promise<{ message: string; output?: string }>;
  disablePlugin?: (id: string) => Promise<{ message: string; output?: string }>;
  uninstallPlugin?: (id: string) => Promise<{ message: string; output?: string }>;
  uninstallSkill?: (slug: string) => Promise<{ message: string; output?: string }>;
  installMcp?: (params: MarketplaceMcpInstallRequest) => Promise<{ name: string; message: string; output?: string }>;
  enableMcp?: (name: string) => Promise<{ message: string; output?: string }>;
  disableMcp?: (name: string) => Promise<{ message: string; output?: string }>;
  removeMcp?: (name: string) => Promise<{ message: string; output?: string }>;
  doctorMcp?: (name: string) => Promise<MarketplaceMcpDoctorResult>;
};

export type MarketplaceApiConfig = {
  apiBaseUrl?: string;
  installer?: MarketplaceInstaller;
};
