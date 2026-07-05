import type { NcpSessionStatus } from '@nextclaw/ncp';
import type { RuntimeEntryView, NcpSessionSummaryView } from './ncp-session.types';
export type { SessionEntryView, RuntimeEntryView, SessionTypeIconView, SessionMessageView, SessionEventView, NcpSessionSummaryView, NcpSessionsListView, NcpMessageView, NcpSessionMessagesView, SessionContextWindowView } from './ncp-session.types';

// API Types - matching backend response format
export type ApiError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

export type AppMetaView = { name: string; productVersion: string };

export type BootstrapPhase =
  | 'kernel-starting'
  | 'shell-ready'
  | 'hydrating-capabilities'
  | 'ready'
  | 'error';

export type BootstrapStageState = 'pending' | 'running' | 'ready' | 'error';

export type BootstrapRemoteState = 'pending' | 'ready' | 'conflict' | 'disabled' | 'error';

export type BootstrapStatusView = {
  phase: BootstrapPhase;
  shellReadyAt?: string;
  ncpAgent: {
    state: BootstrapStageState;
    startedAt?: string;
    completedAt?: string;
    error?: string;
  };
  extensionLoading: {
    state: BootstrapStageState;
    loadedExtensionCount: number;
    totalExtensionCount: number;
    startedAt?: string;
    completedAt?: string;
    error?: string;
  };
  channels: {
    state: BootstrapStageState;
    enabled: string[];
    error?: string;
  };
  remote: {
    state: BootstrapRemoteState;
    message?: string;
  };
  lastError?: string;
};

export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "adaptive" | "xhigh";
export type AgentModelsView = Record<string, {
  params: Record<string, unknown>;
} & Record<string, unknown>>;

export type ProviderInstanceView = {
  providerId: string;
  providerType: string | null;
  isBuiltInType: boolean;
  isCustom: boolean;
  enabled: boolean;
  displayName?: string;
  apiKeySet: boolean;
  apiKeyMasked?: string;
  apiBase?: string | null;
  extraHeaders?: Record<string, string> | null;
  wireApi?: "auto" | "chat" | "responses" | null;
  models?: string[];
  modelConfig?: Record<string, {
    thinking?: { supported: ThinkingLevel[]; default?: ThinkingLevel | null };
    vision?: boolean;
  }>;
};

export type ProviderConfigView = ProviderInstanceView;

export type ProviderConfigUpdate = {
  enabled?: boolean;
  providerType?: string | null;
  displayName?: string | null;
  apiKey?: string | null;
  apiBase?: string | null;
  extraHeaders?: Record<string, string> | null;
  wireApi?: "auto" | "chat" | "responses" | null;
  models?: string[] | null;
  modelConfig?: Record<string, {
    thinking?: { supported?: ThinkingLevel[]; default?: ThinkingLevel | null };
    vision?: boolean;
  }> | null;
};

export type ProviderConnectionTestRequest = ProviderConfigUpdate & {
  model?: string | null;
};

export type ProviderCreateRequest = ProviderConfigUpdate & {
  providerId?: string | null;
};

export type ProviderCreateResult = { providerId: string; provider: ProviderInstanceView };
export type ProviderDeleteResult = { deleted: boolean; providerId: string };
export type ProvidersView = { providers: Record<string, ProviderInstanceView> };

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

export type SearchProviderName = "bocha" | "tavily" | "brave";
export type BochaFreshnessValue = "noLimit" | "oneDay" | "oneWeek" | "oneMonth" | "oneYear" | string;
export type TavilySearchDepthValue = "basic" | "advanced";

export type SearchProviderConfigView = {
  enabled: boolean;
  apiKeySet: boolean;
  apiKeyMasked?: string;
  baseUrl: string;
  docsUrl?: string;
  summary?: boolean;
  freshness?: BochaFreshnessValue;
  searchDepth?: TavilySearchDepthValue;
  includeAnswer?: boolean;
};

export type SearchConfigView = {
  provider: SearchProviderName;
  enabledProviders: SearchProviderName[];
  defaults: {
    maxResults: number;
  };
  providers: {
    bocha: SearchProviderConfigView;
    tavily: SearchProviderConfigView;
    brave: SearchProviderConfigView;
  };
};

export type SearchConfigUpdate = {
  provider?: SearchProviderName;
  enabledProviders?: SearchProviderName[];
  defaults?: {
    maxResults?: number;
  };
  providers?: {
    bocha?: {
      apiKey?: string | null;
      baseUrl?: string | null;
      docsUrl?: string | null;
      summary?: boolean;
      freshness?: BochaFreshnessValue | null;
    };
    tavily?: {
      apiKey?: string | null;
      baseUrl?: string | null;
      searchDepth?: TavilySearchDepthValue | null;
      includeAnswer?: boolean;
    };
    brave?: {
      apiKey?: string | null;
      baseUrl?: string | null;
    };
  };
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

export type ProviderAuthStartRequest = { methodId?: string };
export type ProviderAuthPollRequest = { sessionId: string };

export type ProviderAuthPollResult = {
  provider: string;
  status: "pending" | "authorized" | "denied" | "expired" | "error";
  message?: string;
  nextPollMs?: number;
};

export type ProviderAuthImportResult = { provider: string; status: "imported"; source: "cli"; expiresAt?: string };

export type {
  AuthEnabledUpdateRequest,
  AuthLoginRequest,
  AuthPasswordUpdateRequest,
  AuthSetupRequest,
  AuthStatusView
} from './auth.types';
export type { ChannelAuthPollRequest, ChannelAuthPollResult, ChannelAuthStartRequest, ChannelAuthStartResult } from './channel-auth.types';

export type {
  RemoteAccessView,
  RemoteAccountView,
  RemoteDoctorCheckView,
  RemoteDoctorView,
  RemoteLoginRequest,
  RemoteRuntimeView,
  RemoteServiceAction,
  RemoteServiceActionResult,
  RemoteServiceView,
  RemoteSettingsUpdateRequest,
  RemoteSettingsView
} from './remote.types';
export type {
  RuntimeActionCapability,
  RuntimeActionImpact,
  RuntimeControlAction,
  RuntimeControlEnvironment,
  RuntimeControlView,
  RuntimeLifecycleState,
  RuntimeServiceState,
  RuntimeControlActionResult
} from './runtime-control.types';

export type AgentProfileView = {
  id: string;
  default?: boolean;
  displayName?: string;
  description?: string;
  avatar?: string;
  avatarUrl?: string;
  workspace?: string;
  model?: string;
  runtime?: string;
  runtimeConfig?: Record<string, unknown> | null;
  engine?: string;
  engineConfig?: Record<string, unknown>;
  thinkingDefault?: ThinkingLevel;
  models?: AgentModelsView;
  contextTokens?: number;
  reservedContextTokens?: number;
  maxToolIterations?: number;
  builtIn?: boolean;
};

export type AgentCreateRequest = {
  id: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  home?: string;
  model?: string;
  runtime?: string;
  runtimeConfig?: Record<string, unknown> | null;
  contextTokens?: number | null;
};

export type AgentUpdateRequest = {
  displayName?: string;
  description?: string;
  avatar?: string;
  model?: string;
  runtime?: string;
  runtimeConfig?: Record<string, unknown> | null;
  contextTokens?: number | null;
};

export type AgentDeleteResult = {
  deleted: boolean;
  agentId: string;
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
};

export type SessionSkillEntryView = {
  ref: string;
  name: string;
  path: string;
  scope: 'builtin' | 'project' | 'workspace';
  source: 'builtin' | 'project' | 'workspace';
  available: boolean;
  description?: string;
  descriptionZh?: string;
};

export type NcpSessionSkillsView = {
  sessionId: string;
  total: number;
  refs: string[];
  records: SessionSkillEntryView[];
};

export type NcpAssetView = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  assetUri: string;
  url: string;
};

export type NcpAssetPutView = {
  assets: NcpAssetView[];
};

export type NcpSessionStatusView = NcpSessionStatus;

export type SessionPatchUpdate = {
  label?: string | null;
  preferredModel?: string | null;
  preferredThinking?: ThinkingLevel | null;
  sessionType?: string | null;
  projectRoot?: string | null;
  uiReadAt?: string | null;
  clearHistory?: boolean;
};

export type ServerPathEntryView = { name: string; path: string; kind: "directory" | "file"; hidden: boolean };

export type ServerPathBreadcrumbView = { label: string; path: string };

export type ServerPathBrowseView = {
  currentPath: string;
  parentPath: string | null;
  homePath: string;
  breadcrumbs: ServerPathBreadcrumbView[];
  entries: ServerPathEntryView[];
};

export type ServerPathReadView = { requestedPath: string; resolvedPath: string; kind: "text" | "markdown" | "binary"; sizeBytes: number; truncated: boolean; text?: string; languageHint?: string | null };

export type PanelAppEntryView = {
  id: string;
  appId: string;
  fileName: string;
  kind: "single-file" | "folder";
  title: string;
  description?: string;
  icon?: string;
  contentPath: string;
  createdAt: string;
  updatedAt: string;
  sizeBytes: number;
  favorite: boolean;
  clientDeclared: boolean;
  clientGranted: boolean;
  lastOpenedAt?: string;
  openCount: number;
};

export type PanelAppListView = {
  workspacePath: string;
  panelsPath: string;
  entries: PanelAppEntryView[];
};

export type PanelAppPreferencesUpdateView = {
  favorite?: boolean;
};

export type {
  ChatSessionTypeCtaView,
  ChatSessionTypeOptionView,
  ChatSessionTypesView,
} from './chat-session-type.types';

export type CronScheduleView =
  | { kind: "at"; atMs?: number | null }
  | { kind: "every"; everyMs?: number | null }
  | { kind: "cron"; expr?: string | null; tz?: string | null };

export type CronPayloadView = {
  kind?: "system_event" | "agent_turn";
  message: string;
  agentId?: string | null;
  sessionId?: string | null;
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

export type CronListView = { jobs: CronJobView[]; total: number };

export type CronEnableRequest = { enabled: boolean };

export type CronRunRequest = { force?: boolean };

export type CronActionResult = {
  job: CronJobView | null;
  executed?: boolean;
};

export type RuntimeConfigUpdate = {
  companion?: {
    enabled?: boolean;
  };
  agents?: {
    defaults?: {
      contextTokens?: number;
      engine?: string;
      engineConfig?: Record<string, unknown>;
      thinkingDefault?: ThinkingLevel;
    };
    runtimes?: {
      entries?: Record<string, RuntimeEntryView> | null;
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
  companion?: {
    enabled?: boolean;
  };
  agents: {
    defaults: {
      model: string;
      workspace?: string;
      engine?: string;
      engineConfig?: Record<string, unknown>;
      thinkingDefault?: ThinkingLevel;
      models?: AgentModelsView;
      contextTokens?: number;
      reservedContextTokens?: number;
      maxToolIterations?: number;
    };
    runtimes?: {
      entries?: Record<string, RuntimeEntryView>;
    };
    list?: AgentProfileView[];
    context?: {
      bootstrap?: {
        files?: string[];
        minimalFiles?: string[];
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
  search: SearchConfigView;
  channels: Record<string, Record<string, unknown>>;
  bindings?: AgentBindingView[];
  session?: SessionConfigView;
  tools?: Record<string, unknown>;
  gateway?: Record<string, unknown>;
  ui?: Record<string, unknown>;
  secrets?: SecretsView;
};

export type ProviderTemplateView = {
  id: string;
  providerType: string;
  displayName?: string;
  apiProtocol?: "openai-compatible" | "anthropic-messages";
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
  modelConfig?: Record<string, {
    thinking?: { supported: ThinkingLevel[]; default?: ThinkingLevel | null };
    vision?: boolean;
  }>;
  supportsWireApi?: boolean;
  wireApiOptions?: Array<"auto" | "chat" | "responses">;
  defaultWireApi?: "auto" | "chat" | "responses";
};

export type ProviderTemplatesView = {
  providerTemplates: ProviderTemplateView[];
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

export type SearchProviderSpecView = {
  name: SearchProviderName;
  displayName: string;
  description: string;
  docsUrl?: string;
  isDefault?: boolean;
  supportsSummary?: boolean;
};

export type ConfigMetaView = {
  search: SearchProviderSpecView[];
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
  | { type: 'channel.config.apply-status'; payload: { channel: string; status: 'started' | 'succeeded' | 'failed'; message?: string } }
  | { type: 'session.updated'; payload: { sessionKey: string } }
  | { type: 'session.run-status'; payload: { sessionKey: string; status: 'running' | 'idle' } }
  | { type: 'session.summary.upsert'; payload: { summary: NcpSessionSummaryView } }
  | { type: 'session.summary.delete'; payload: { sessionKey: string } }
  | { type: 'config.reload.started'; payload?: Record<string, unknown> }
  | { type: 'config.reload.finished'; payload?: Record<string, unknown> }
  | { type: 'error'; payload: { message: string; code?: string } }
  | { type: 'connection.open'; payload?: Record<string, unknown> }
  | { type: 'connection.close'; payload?: Record<string, unknown> }
  | { type: 'connection.error'; payload?: { message?: string } };

export type * from './marketplace.types';
