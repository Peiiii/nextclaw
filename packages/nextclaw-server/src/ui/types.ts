import type { CronService, ThinkingLevel } from "@nextclaw/core";
import type { PluginChannelBinding, PluginUiMetadata } from "@nextclaw/openclaw-compat";
import type { NcpAgentClientEndpoint, NcpMessage, NcpSessionApi, NcpSessionStatus, NcpSessionSummary } from "@nextclaw/ncp";
import type { NcpHttpAgentStreamProvider } from "@nextclaw/ncp-http-agent-server";
import type { UiNcpStoredAssetRecord } from "./ncp-attachment.types.js";
import type { MarketplaceApiConfig } from "./marketplace.types.js";
import type { UiRemoteAccessHost } from "./ui-routes/types.js";
export type * from "./marketplace.types.js";
export type * from "./ncp-attachment.types.js";
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

export type BootstrapPhase =
  | "kernel-starting"
  | "shell-ready"
  | "hydrating-capabilities"
  | "ready"
  | "error";

export type BootstrapStageState = "pending" | "running" | "ready" | "error";

export type BootstrapRemoteState = "pending" | "ready" | "conflict" | "disabled" | "error";

export type BootstrapStatusView = {
  phase: BootstrapPhase;
  shellReadyAt?: string;
  pluginHydration: {
    state: BootstrapStageState;
    loadedPluginCount: number;
    totalPluginCount: number;
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

export type ProviderConfigView = {
  enabled: boolean;
  displayName?: string;
  apiKeySet: boolean;
  apiKeyMasked?: string;
  apiBase?: string | null;
  extraHeaders?: Record<string, string> | null;
  wireApi?: "auto" | "chat" | "responses" | null;
  models?: string[];
  modelThinking?: Record<string, { supported: ThinkingLevel[]; default?: ThinkingLevel | null }>;
};

export type ProviderConfigUpdate = {
  enabled?: boolean;
  displayName?: string | null;
  apiKey?: string | null;
  apiBase?: string | null;
  extraHeaders?: Record<string, string> | null;
  wireApi?: "auto" | "chat" | "responses" | null;
  models?: string[] | null;
  modelThinking?: Record<string, { supported?: ThinkingLevel[]; default?: ThinkingLevel | null }> | null;
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

export type SearchProviderName = "bocha" | "brave";
export type BochaFreshnessValue = "noLimit" | "oneDay" | "oneWeek" | "oneMonth" | "oneYear" | string;

export type SearchProviderConfigView = {
  enabled: boolean;
  apiKeySet: boolean;
  apiKeyMasked?: string;
  baseUrl: string;
  docsUrl?: string;
  summary?: boolean;
  freshness?: BochaFreshnessValue;
};

export type SearchConfigView = {
  provider: SearchProviderName;
  enabledProviders: SearchProviderName[];
  defaults: {
    maxResults: number;
  };
  providers: {
    bocha: SearchProviderConfigView;
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

export type ChannelAuthStartRequest = {
  accountId?: string;
  baseUrl?: string;
};

export type ChannelAuthStartResult = {
  channel: string;
  kind: "qr_code";
  sessionId: string;
  qrCode: string;
  qrCodeUrl: string;
  expiresAt: string;
  intervalMs: number;
  note?: string;
};

export type ChannelAuthPollRequest = {
  sessionId: string;
};

export type ChannelAuthPollResult = {
  channel: string;
  status: "pending" | "scanned" | "authorized" | "expired" | "error";
  message?: string;
  nextPollMs?: number;
  accountId?: string | null;
  notes?: string[];
};

export type AuthStatusView = {
  enabled: boolean;
  configured: boolean;
  authenticated: boolean;
  username?: string;
};

export type AuthSetupRequest = {
  username: string;
  password: string;
};

export type AuthLoginRequest = {
  username: string;
  password: string;
};

export type AuthPasswordUpdateRequest = {
  password: string;
};

export type AuthEnabledUpdateRequest = {
  enabled: boolean;
};

export type RemoteAccountView = {
  loggedIn: boolean;
  email?: string;
  role?: string;
  platformBase?: string | null;
  apiBase?: string | null;
};

export type RemoteRuntimeView = {
  enabled: boolean;
  mode: "service" | "foreground";
  state: "disabled" | "connecting" | "connected" | "disconnected" | "error";
  deviceId?: string;
  deviceName?: string;
  platformBase?: string;
  localOrigin?: string;
  lastConnectedAt?: string | null;
  lastError?: string | null;
  updatedAt: string;
};

export type RemoteServiceView = {
  running: boolean;
  pid?: number;
  uiUrl?: string;
  uiPort?: number;
  currentProcess: boolean;
};

export type RemoteSettingsView = {
  enabled: boolean;
  deviceName: string;
  platformApiBase: string;
};

export type RemoteAccessView = {
  account: RemoteAccountView;
  settings: RemoteSettingsView;
  service: RemoteServiceView;
  localOrigin: string;
  configuredEnabled: boolean;
  platformBase?: string | null;
  runtime: RemoteRuntimeView | null;
};

export type RemoteDoctorCheckView = {
  name: string;
  ok: boolean;
  detail: string;
};

export type RemoteDoctorView = {
  generatedAt: string;
  checks: RemoteDoctorCheckView[];
  snapshot: {
    configuredEnabled: boolean;
    runtime: RemoteRuntimeView | null;
  };
};

export type RemoteLoginRequest = {
  email: string;
  password: string;
  apiBase?: string;
};

export type RemoteBrowserAuthStartRequest = {
  apiBase?: string;
};

export type RemoteBrowserAuthStartResult = {
  sessionId: string;
  verificationUri: string;
  expiresAt: string;
  intervalMs: number;
};

export type RemoteBrowserAuthPollRequest = {
  sessionId: string;
  apiBase?: string;
};

export type RemoteBrowserAuthPollResult = {
  status: "pending" | "authorized" | "expired";
  message?: string;
  nextPollMs?: number;
  email?: string;
  role?: string;
};

export type RemoteSettingsUpdateRequest = {
  enabled?: boolean;
  deviceName?: string;
  platformApiBase?: string;
};

export type RemoteServiceAction = "start" | "restart" | "stop";

export type RemoteServiceActionResult = {
  accepted: boolean;
  action: RemoteServiceAction;
  message: string;
};

export type AgentProfileView = {
  id: string;
  default?: boolean;
  displayName?: string;
  description?: string;
  avatar?: string;
  avatarUrl?: string;
  workspace?: string;
  model?: string;
  engine?: string;
  engineConfig?: Record<string, unknown>;
  contextTokens?: number;
  maxToolIterations?: number;
  builtIn?: boolean;
};

export type AgentCreateRequest = {
  id: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  home?: string;
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

import type { ChatSessionTypesView } from "./chat-session-type.types.js";

export type {
  ChatSessionTypeCtaView,
  ChatSessionTypeOptionView,
  ChatSessionTypesView,
} from "./chat-session-type.types.js";

export type SessionEntryView = {
  key: string;
  createdAt: string;
  updatedAt: string;
  label?: string;
  preferredModel?: string;
  preferredThinking?: ThinkingLevel | null;
  sessionType: string;
  sessionTypeMutable: boolean;
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
  sessionType: string;
  sessionTypeMutable: boolean;
  metadata: Record<string, unknown>;
  messages: SessionMessageView[];
  events: SessionEventView[];
};

export type SessionPatchUpdate = {
  label?: string | null;
  preferredModel?: string | null;
  preferredThinking?: ThinkingLevel | null;
  sessionType?: string | null;
  projectRoot?: string | null;
  clearHistory?: boolean;
};

export type SessionSkillEntryView = {
  ref: string;
  name: string;
  path: string;
  scope: "builtin" | "project" | "workspace";
  source: "builtin" | "project" | "workspace";
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

export type ServerPathEntryView = {
  name: string;
  path: string;
  kind: "directory" | "file";
  hidden: boolean;
};

export type ServerPathBreadcrumbView = {
  label: string;
  path: string;
};

export type ServerPathBrowseView = {
  currentPath: string;
  parentPath: string | null;
  homePath: string;
  breadcrumbs: ServerPathBreadcrumbView[];
  entries: ServerPathEntryView[];
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

export type UiNcpSessionListView = {
  sessions: NcpSessionSummary[];
  total: number;
};

export type UiNcpSessionMessagesView = {
  sessionId: string;
  status: NcpSessionStatus;
  messages: NcpMessage[];
  total: number;
};

export type SessionTypeDescribeParams = {
  describeMode?: "observation" | "probe";
};

export type UiNcpSessionService = NcpSessionApi;

export type UiNcpAgent = {
  agentClientEndpoint: NcpAgentClientEndpoint;
  streamProvider?: NcpHttpAgentStreamProvider;
  listSessionTypes?: (params?: SessionTypeDescribeParams) => Promise<ChatSessionTypesView> | ChatSessionTypesView;
  assetApi?: {
    put: (input: {
      fileName: string;
      mimeType?: string | null;
      bytes: Uint8Array;
      createdAt?: Date;
    }) => Promise<UiNcpStoredAssetRecord>;
    stat: (uri: string) => Promise<UiNcpStoredAssetRecord | null> | UiNcpStoredAssetRecord | null;
    resolveContentPath: (uri: string) => string | null;
  };
  basePath?: string;
};

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
  search: SearchConfigView;
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

export type SearchProviderSpecView = {
  name: SearchProviderName;
  displayName: string;
  description: string;
  docsUrl?: string;
  isDefault?: boolean;
  supportsSummary?: boolean;
};

export type ConfigMetaView = {
  providers: ProviderSpecView[];
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

export type UiServerEvent =
  | { type: "config.updated"; payload: { path: string } }
  | { type: "session.updated"; payload: { sessionKey: string } }
  | { type: "session.run-status"; payload: { sessionKey: string; status: "running" | "idle" } }
  | { type: "session.summary.upsert"; payload: { summary: NcpSessionSummary } }
  | { type: "session.summary.delete"; payload: { sessionKey: string } }
  | { type: "config.reload.started"; payload?: Record<string, unknown> }
  | { type: "config.reload.finished"; payload?: Record<string, unknown> }
  | { type: "error"; payload: { message: string; code?: string } };

export type UiServerOptions = {
  host: string;
  port: number;
  configPath: string;
  productVersion?: string;
  corsOrigins?: string[] | "*";
  staticDir?: string;
  initializeAgentHomeDirectory?: (homeDirectory: string) => void;
  marketplace?: MarketplaceApiConfig;
  cronService?: CronService;
  ncpAgent?: UiNcpAgent;
  ncpSessionService?: UiNcpSessionService;
  remoteAccess?: UiRemoteAccessHost;
  getBootstrapStatus?: () => BootstrapStatusView;
  getPluginChannelBindings?: () => PluginChannelBinding[];
  getPluginUiMetadata?: () => PluginUiMetadata[];
};

export type UiServerHandle = {
  host: string;
  port: number;
  close: () => Promise<void>;
  publish: (event: UiServerEvent) => void;
};
