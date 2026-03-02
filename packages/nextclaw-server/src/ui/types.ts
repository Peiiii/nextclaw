import type { CronService } from "@nextclaw/core";

export type ApiError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

export type ProviderConfigView = {
  displayName?: string;
  apiKeySet: boolean;
  apiKeyMasked?: string;
  apiBase?: string | null;
  extraHeaders?: Record<string, string> | null;
  wireApi?: "auto" | "chat" | "responses" | null;
  models?: string[];
};

export type ProviderConfigUpdate = {
  displayName?: string | null;
  apiKey?: string | null;
  apiBase?: string | null;
  extraHeaders?: Record<string, string> | null;
  wireApi?: "auto" | "chat" | "responses" | null;
  models?: string[] | null;
};

export type ProviderConnectionTestRequest = ProviderConfigUpdate & {
  model?: string | null;
};

export type ProviderCreateRequest = ProviderConfigUpdate;

export type ProviderCreateResult = {
  name: string;
  provider: ProviderConfigView;
};

export type ProviderDeleteResult = {
  deleted: boolean;
  provider: string;
};

export type ProviderConnectionTestResult = {
  success: boolean;
  provider: string;
  model?: string;
  latencyMs: number;
  message: string;
};

export type AgentProfileView = {
  id: string;
  default?: boolean;
  workspace?: string;
  model?: string;
  contextTokens?: number;
  maxToolIterations?: number;
};

export type BindingPeerView = {
  kind: "direct" | "group" | "channel";
  id: string;
};

export type AgentBindingView = {
  agentId: string;
  match: {
    channel: string;
    accountId?: string;
    peer?: BindingPeerView;
  };
};

export type SessionConfigView = {
  dmScope?: "main" | "per-peer" | "per-channel-peer" | "per-account-channel-peer";
  agentToAgent?: {
    maxPingPongTurns?: number;
  };
};

export type SessionEntryView = {
  key: string;
  createdAt: string;
  updatedAt: string;
  label?: string;
  preferredModel?: string;
  messageCount: number;
  lastRole?: string;
  lastTimestamp?: string;
};

export type SessionsListView = {
  sessions: SessionEntryView[];
  total: number;
};

export type SessionMessageView = {
  role: string;
  content: unknown;
  timestamp: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<Record<string, unknown>>;
  reasoning_content?: string;
};

export type SessionEventView = {
  seq: number;
  type: string;
  timestamp: string;
  message?: SessionMessageView;
};

export type SessionHistoryView = {
  key: string;
  totalMessages: number;
  totalEvents: number;
  metadata: Record<string, unknown>;
  messages: SessionMessageView[];
  events: SessionEventView[];
};

export type SessionPatchUpdate = {
  label?: string | null;
  preferredModel?: string | null;
  clearHistory?: boolean;
};

export type CronScheduleView =
  | { kind: "at"; atMs?: number | null }
  | { kind: "every"; everyMs?: number | null }
  | { kind: "cron"; expr?: string | null; tz?: string | null };

export type CronPayloadView = {
  kind?: "system_event" | "agent_turn";
  message: string;
  deliver?: boolean;
  channel?: string | null;
  to?: string | null;
};

export type CronJobStateView = {
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  lastStatus?: "ok" | "error" | "skipped" | null;
  lastError?: string | null;
};

export type CronJobView = {
  id: string;
  name: string;
  enabled: boolean;
  schedule: CronScheduleView;
  payload: CronPayloadView;
  state: CronJobStateView;
  createdAt: string;
  updatedAt: string;
  deleteAfterRun: boolean;
};

export type CronListView = {
  jobs: CronJobView[];
  total: number;
};

export type CronEnableRequest = {
  enabled: boolean;
};

export type CronRunRequest = {
  force?: boolean;
};

export type CronActionResult = {
  job: CronJobView | null;
  executed?: boolean;
};

export type RuntimeConfigUpdate = {
  agents?: {
    defaults?: {
      contextTokens?: number;
    };
    list?: AgentProfileView[];
  };
  bindings?: AgentBindingView[];
  session?: SessionConfigView;
};

export type SecretSourceView = "env" | "file" | "exec";

export type SecretRefView = {
  source: SecretSourceView;
  provider?: string;
  id: string;
};

export type SecretProviderEnvView = {
  source: "env";
  prefix?: string;
};

export type SecretProviderFileView = {
  source: "file";
  path: string;
  format?: "json";
};

export type SecretProviderExecView = {
  source: "exec";
  command: string;
  args?: string[];
  cwd?: string;
  timeoutMs?: number;
};

export type SecretProviderView = SecretProviderEnvView | SecretProviderFileView | SecretProviderExecView;

export type SecretsView = {
  enabled: boolean;
  defaults: {
    env?: string;
    file?: string;
    exec?: string;
  };
  providers: Record<string, SecretProviderView>;
  refs: Record<string, SecretRefView>;
};

export type SecretsConfigUpdate = {
  enabled?: boolean;
  defaults?: {
    env?: string | null;
    file?: string | null;
    exec?: string | null;
  };
  providers?: Record<string, SecretProviderView> | null;
  refs?: Record<string, SecretRefView> | null;
};

export type ChatTurnRequest = {
  message: string;
  sessionKey?: string;
  agentId?: string;
  channel?: string;
  chatId?: string;
  model?: string;
  metadata?: Record<string, unknown>;
};

export type ChatTurnResult = {
  reply: string;
  sessionKey: string;
  agentId?: string;
  model?: string;
  metadata?: Record<string, unknown>;
};

export type ChatTurnStreamEvent =
  | {
      type: "delta";
      delta: string;
    }
  | {
      type: "session_event";
      event: SessionEventView;
    }
  | {
      type: "final";
      result: ChatTurnResult;
    }
  | {
      type: "error";
      error: string;
    };

export type ChatTurnView = {
  reply: string;
  sessionKey: string;
  agentId?: string;
  model?: string;
  requestedAt: string;
  completedAt: string;
  durationMs: number;
};

export type UiChatRuntime = {
  processTurn: (params: ChatTurnRequest) => Promise<ChatTurnResult>;
  processTurnStream?: (params: ChatTurnRequest) => AsyncGenerator<ChatTurnStreamEvent>;
};

export type ConfigView = {
  agents: {
    defaults: {
      model: string;
      workspace?: string;
      contextTokens?: number;
      maxToolIterations?: number;
    };
    list?: AgentProfileView[];
    context?: {
      bootstrap?: {
        files?: string[];
        minimalFiles?: string[];
        heartbeatFiles?: string[];
        perFileChars?: number;
        totalChars?: number;
      };
      memory?: {
        enabled?: boolean;
        maxChars?: number;
      };
    };
  };
  providers: Record<string, ProviderConfigView>;
  channels: Record<string, Record<string, unknown>>;
  bindings?: AgentBindingView[];
  session?: SessionConfigView;
  tools?: Record<string, unknown>;
  gateway?: Record<string, unknown>;
  ui?: Record<string, unknown>;
  secrets?: SecretsView;
};

export type ProviderSpecView = {
  name: string;
  displayName?: string;
  isCustom?: boolean;
  modelPrefix?: string;
  keywords: string[];
  envKey: string;
  isGateway?: boolean;
  isLocal?: boolean;
  defaultApiBase?: string;
  defaultModels?: string[];
  supportsWireApi?: boolean;
  wireApiOptions?: Array<"auto" | "chat" | "responses">;
  defaultWireApi?: "auto" | "chat" | "responses";
};

export type ChannelSpecView = {
  name: string;
  displayName?: string;
  enabled: boolean;
  tutorialUrl?: string;
  tutorialUrls?: {
    default?: string;
    en?: string;
    zh?: string;
  };
};

export type ConfigMetaView = {
  providers: ProviderSpecView[];
  channels: ChannelSpecView[];
};

export type ConfigUiHint = {
  label?: string;
  help?: string;
  group?: string;
  order?: number;
  advanced?: boolean;
  sensitive?: boolean;
  placeholder?: string;
  readOnly?: boolean;
};

export type ConfigUiHints = Record<string, ConfigUiHint>;

export type ConfigSchemaResponse = {
  schema: Record<string, unknown>;
  uiHints: ConfigUiHints;
  actions: ConfigActionManifest[];
  version: string;
  generatedAt: string;
};

export type ConfigActionType = "httpProbe" | "oauthStart" | "webhookVerify" | "openUrl" | "copyToken";

export type ConfigActionManifest = {
  id: string;
  version: string;
  scope: string;
  title: string;
  description?: string;
  type: ConfigActionType;
  trigger: "manual" | "afterSave";
  requires?: string[];
  request: {
    method: "GET" | "POST" | "PUT";
    path: string;
    timeoutMs?: number;
  };
  success?: {
    message?: string;
  };
  failure?: {
    message?: string;
  };
  saveBeforeRun?: boolean;
  savePatch?: Record<string, unknown>;
  resultMap?: Record<string, string>;
  policy?: {
    roles?: string[];
    rateLimitKey?: string;
    cooldownMs?: number;
    audit?: boolean;
  };
};

export type ConfigActionExecuteRequest = {
  scope?: string;
  draftConfig?: Record<string, unknown>;
  context?: {
    actor?: string;
    traceId?: string;
  };
};

export type ConfigActionExecuteResult = {
  ok: boolean;
  status: "success" | "failed";
  message: string;
  data?: Record<string, unknown>;
  patch?: Record<string, unknown>;
  nextActions?: string[];
};

export type MarketplaceItemType = "plugin" | "skill";

export type MarketplaceSort = "relevance" | "updated";

export type MarketplaceInstallKind = "npm" | "clawhub" | "git" | "builtin";

export type MarketplaceInstallSpec = {
  kind: MarketplaceInstallKind;
  spec: string;
  command: string;
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
  source: "workspace" | "builtin" | "git" | "remote";
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
  source?: string;
  installedAt?: string;
  enabled?: boolean;
  runtimeStatus?: string;
  origin?: string;
  installPath?: string;
};

export type MarketplaceInstalledView = {
  type: MarketplaceItemType;
  total: number;
  specs: string[];
  records: MarketplaceInstalledRecord[];
};

export type MarketplaceInstallSkillParams = {
  slug: string;
  kind?: MarketplaceInstallKind;
  skill?: string;
  installPath?: string;
  version?: string;
  registry?: string;
  force?: boolean;
};

export type MarketplacePluginInstallRequest = {
  type?: "plugin";
  spec: string;
};

export type MarketplaceSkillInstallRequest = {
  type?: "skill";
  spec: string;
  kind?: MarketplaceInstallKind;
  skill?: string;
  installPath?: string;
  version?: string;
  registry?: string;
  force?: boolean;
};

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

export type MarketplacePluginManageAction = "enable" | "disable" | "uninstall";
export type MarketplaceSkillManageAction = "uninstall";

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

export type MarketplaceInstaller = {
  installPlugin?: (spec: string) => Promise<{ message: string; output?: string }>;
  installSkill?: (params: MarketplaceInstallSkillParams) => Promise<{ message: string; output?: string }>;
  enablePlugin?: (id: string) => Promise<{ message: string; output?: string }>;
  disablePlugin?: (id: string) => Promise<{ message: string; output?: string }>;
  uninstallPlugin?: (id: string) => Promise<{ message: string; output?: string }>;
  uninstallSkill?: (slug: string) => Promise<{ message: string; output?: string }>;
};

export type MarketplaceApiConfig = {
  apiBaseUrl?: string;
  installer?: MarketplaceInstaller;
};

export type UiServerEvent =
  | { type: "config.updated"; payload: { path: string } }
  | { type: "config.reload.started"; payload?: Record<string, unknown> }
  | { type: "config.reload.finished"; payload?: Record<string, unknown> }
  | { type: "error"; payload: { message: string; code?: string } };

export type UiServerOptions = {
  host: string;
  port: number;
  configPath: string;
  corsOrigins?: string[] | "*";
  staticDir?: string;
  marketplace?: MarketplaceApiConfig;
  cronService?: CronService;
  chatRuntime?: UiChatRuntime;
};

export type UiServerHandle = {
  host: string;
  port: number;
  close: () => Promise<void>;
  publish: (event: UiServerEvent) => void;
};
