// API Types - matching backend response format
export type ApiError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

export type AppMetaView = {
  name: string;
  productVersion: string;
};

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

export type ProviderConnectionTestErrorCode =
  | 'API_KEY_REQUIRED'
  | 'MODEL_REQUIRED'
  | 'AUTH_FAILED'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMITED'
  | 'MODEL_NOT_FOUND'
  | 'INVALID_ENDPOINT'
  | 'INVALID_REQUEST'
  | 'NETWORK_ERROR'
  | 'SERVER_ERROR'
  | 'UNKNOWN_ERROR';

export type ProviderConnectionTestResult = {
  success: boolean;
  provider: string;
  model?: string;
  latencyMs: number;
  message: string;
  errorCode?: ProviderConnectionTestErrorCode;
  httpStatus?: number;
  endpoint?: string;
  hint?: string;
};

export type ProviderAuthStartResult = {
  provider: string;
  kind: "device_code";
  methodId?: string;
  sessionId: string;
  verificationUri: string;
  userCode: string;
  expiresAt: string;
  intervalMs: number;
  note?: string;
};

export type ProviderAuthStartRequest = {
  methodId?: string;
};

export type ProviderAuthPollRequest = {
  sessionId: string;
};

export type ProviderAuthPollResult = {
  provider: string;
  status: "pending" | "authorized" | "denied" | "expired" | "error";
  message?: string;
  nextPollMs?: number;
};

export type ProviderAuthImportResult = {
  provider: string;
  status: "imported";
  source: "cli";
  expiresAt?: string;
};

export type AgentProfileView = {
  id: string;
  default?: boolean;
  workspace?: string;
  model?: string;
  engine?: string;
  engineConfig?: Record<string, unknown>;
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

export type ChatTurnRequest = {
  message: string;
  sessionKey?: string;
  agentId?: string;
  channel?: string;
  chatId?: string;
  model?: string;
  metadata?: Record<string, unknown>;
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

export type ChatCapabilitiesView = {
  stopSupported: boolean;
  stopReason?: string;
};

export type ChatCommandOptionView = {
  name: string;
  description: string;
  type: 'string' | 'boolean' | 'number';
  required?: boolean;
};

export type ChatCommandView = {
  name: string;
  description: string;
  options?: ChatCommandOptionView[];
};

export type ChatCommandsView = {
  commands: ChatCommandView[];
  total: number;
};

export type ChatTurnStopRequest = {
  runId: string;
  sessionKey?: string;
  agentId?: string;
};

export type ChatTurnStopResult = {
  stopped: boolean;
  runId: string;
  sessionKey?: string;
  reason?: string;
};

export type ChatRunState = 'queued' | 'running' | 'completed' | 'failed' | 'aborted';

export type ChatRunView = {
  runId: string;
  sessionKey: string;
  agentId?: string;
  model?: string;
  state: ChatRunState;
  requestedAt: string;
  startedAt?: string;
  completedAt?: string;
  stopSupported: boolean;
  stopReason?: string;
  error?: string;
  reply?: string;
  eventCount: number;
};

export type ChatRunListView = {
  runs: ChatRunView[];
  total: number;
};

export type ChatTurnStreamReadyEvent = {
  event: "ready";
  sessionKey: string;
  requestedAt: string;
  runId?: string;
  stopSupported?: boolean;
  stopReason?: string;
};

export type ChatTurnStreamDeltaEvent = {
  event: "delta";
  delta: string;
};

export type ChatTurnStreamSessionEvent = {
  event: "session_event";
  data: SessionEventView;
};

export type ChatTurnStreamFinalEvent = {
  event: "final";
  data: ChatTurnView;
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
      engine?: string;
      engineConfig?: Record<string, unknown>;
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

export type ChannelConfigUpdate = Record<string, unknown>;

export type ConfigView = {
  agents: {
    defaults: {
      model: string;
      workspace?: string;
      engine?: string;
      engineConfig?: Record<string, unknown>;
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
  logo?: string;
  apiBaseHelp?: {
    en?: string;
    zh?: string;
  };
  auth?: {
    kind: "device_code";
    displayName?: string;
    note?: {
      en?: string;
      zh?: string;
    };
    methods?: Array<{
      id: string;
      label?: {
        en?: string;
        zh?: string;
      };
      hint?: {
        en?: string;
        zh?: string;
      };
    }>;
    defaultMethodId?: string;
    supportsCliImport?: boolean;
  };
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

export type ConfigActionType = 'httpProbe' | 'oauthStart' | 'webhookVerify' | 'openUrl' | 'copyToken';

export type ConfigActionManifest = {
  id: string;
  version: string;
  scope: string;
  title: string;
  description?: string;
  type: ConfigActionType;
  trigger: 'manual' | 'afterSave';
  requires?: string[];
  request: {
    method: 'GET' | 'POST' | 'PUT';
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
  status: 'success' | 'failed';
  message: string;
  data?: Record<string, unknown>;
  patch?: Record<string, unknown>;
  nextActions?: string[];
};

// WebSocket events
export type WsEvent =
  | { type: 'config.updated'; payload: { path: string } }
  | { type: 'run.updated'; payload: { run: ChatRunView } }
  | { type: 'session.updated'; payload: { sessionKey: string } }
  | { type: 'config.reload.started'; payload?: Record<string, unknown> }
  | { type: 'config.reload.finished'; payload?: Record<string, unknown> }
  | { type: 'error'; payload: { message: string; code?: string } }
  | { type: 'connection.open'; payload?: Record<string, unknown> };

export type MarketplaceItemType = 'plugin' | 'skill';

export type MarketplaceSort = 'relevance' | 'updated';

export type MarketplacePluginInstallKind = 'npm';
export type MarketplaceSkillInstallKind = 'builtin' | 'marketplace';
export type MarketplaceInstallKind = MarketplacePluginInstallKind | MarketplaceSkillInstallKind;

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

export type MarketplacePluginContentView = {
  type: 'plugin';
  slug: string;
  name: string;
  install: MarketplaceInstallSpec;
  source: 'npm' | 'repo' | 'remote';
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
  description?: string;
  descriptionZh?: string;
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

export type MarketplaceInstallRequest = {
  type: MarketplaceItemType;
  spec: string;
  kind?: MarketplaceInstallKind;
  skill?: string;
  installPath?: string;
  force?: boolean;
};

export type MarketplaceInstallResult = {
  type: MarketplaceItemType;
  spec: string;
  message: string;
  output?: string;
};

export type MarketplaceManageAction = 'enable' | 'disable' | 'uninstall';

export type MarketplaceManageRequest = {
  type: MarketplaceItemType;
  action: MarketplaceManageAction;
  id?: string;
  spec?: string;
};

export type MarketplaceManageResult = {
  type: MarketplaceItemType;
  action: MarketplaceManageAction;
  id: string;
  message: string;
  output?: string;
};
