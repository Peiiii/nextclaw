import type { Config, ThinkingLevel } from "@nextclaw/core";
import type { AgentProfileView } from "./server-api-agent.types.js";
import type { AppEvent } from "@nextclaw/shared";
import type { NcpMessage, NcpSessionApi, NcpSessionMessagePageInfo, NcpSessionStatus, NcpSessionSummary } from "@nextclaw/ncp";
import type { UiNcpStoredAssetRecord } from "@nextclaw-server/features/attachments/index.js";
export type { AgentCreateRequest, AgentDeleteResult, AgentProfileView, AgentUpdateRequest } from "./server-api-agent.types.js";
export type * from "@nextclaw-server/features/marketplace/types/marketplace.types.js";
export type * from "@nextclaw-server/features/attachments/index.js";
export type * from "@nextclaw-server/features/panel-apps/index.js";
export type * from "@nextclaw-server/features/preferences/index.js";
export type * from "@nextclaw-server/features/service-apps/index.js";
export type * from "./server-api-cron.types.js";

type AgentDefaultModelsView = Config["agents"]["defaults"]["models"];
export type ApiError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export type AppMetaView = {
  name: string;
  productVersion: string;
};

export type BootstrapPhase = "kernel-starting" | "shell-ready" | "hydrating-capabilities" | "ready" | "error";

export type BootstrapStageState = "pending" | "running" | "ready" | "error";

export type BootstrapRemoteState = "pending" | "ready" | "conflict" | "disabled" | "error";

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
  modelConfig?: Record<
    string,
    {
      thinking?: { supported: ThinkingLevel[]; default?: ThinkingLevel | null };
      vision?: boolean;
    }
  >;
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
  modelConfig?: Record<
    string,
    {
      thinking?: {
        supported?: ThinkingLevel[];
        default?: ThinkingLevel | null;
      };
      vision?: boolean;
    }
  > | null;
};

export type ProviderConnectionTestRequest = ProviderConfigUpdate & {
  model?: string | null;
};

export type ProviderCreateRequest = ProviderConfigUpdate & {
  providerId?: string | null;
};

export type ProviderCreateResult = {
  providerId: string;
  provider: ProviderInstanceView;
};

export type ProviderDeleteResult = {
  deleted: boolean;
  providerId: string;
};

export type ProviderConnectionTestResult = {
  success: boolean;
  provider: string;
  model?: string;
  latencyMs: number;
  message: string;
};

export type ProvidersView = {
  providers: Record<string, ProviderInstanceView>;
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
  domain?: string;
};

export type ChannelAuthConnectRequest = {
  accountId?: string;
  domain?: string;
  fields?: Record<string, unknown>;
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

export type ChannelAuthConnectResult = ChannelAuthPollResult;

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
  username?: string | null;
  role?: string;
  platformBase?: string | null;
  apiBase?: string | null;
};

export type RemoteAccountProfileUpdateRequest = {
  username: string;
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

export type RuntimeEntryView = {
  enabled?: boolean;
  label?: string;
  icon?: {
    kind: "image";
    src: string;
    alt?: string | null;
  } | null;
  type: string;
  config?: Record<string, unknown>;
};

export type { ChatSessionTypeCtaView, ChatSessionTypeOptionView, ChatSessionTypesView } from "@nextclaw-server/features/sessions/index.js";
export type { ProjectAddExistingRequest, ProjectCreateRequest, ProjectListView, ProjectTemplateView, ProjectView } from "@nextclaw-server/features/projects/index.js";

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
  uiReadAt?: string | null;
  clearHistory?: boolean;
};

export type SessionSkillEntryView = {
  ref: string;
  name: string;
  path: string;
  scope: "builtin" | "global" | "project" | "workspace";
  source: "builtin" | "global" | "project" | "workspace";
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

export type ServerPathBreadcrumbView = { label: string; path: string };

export type ServerPathLocationView = {
  kind: "desktop" | "documents" | "downloads" | "icloud-drive" | "applications" | "volumes";
  path: string;
};

export type ServerPathBrowseView = {
  currentPath: string;
  parentPath: string | null;
  homePath: string;
  breadcrumbs: ServerPathBreadcrumbView[];
  entries: ServerPathEntryView[];
  locations: ServerPathLocationView[];
};

export type ServerPathSearchEntryView = {
  name: string;
  path: string;
  relativePath: string;
  parentRelativePath: string;
  kind: "directory" | "file";
  hidden: boolean;
};

export type ServerPathSearchView = {
  basePath: string;
  query: string;
  entries: ServerPathSearchEntryView[];
  truncated: boolean;
};

export type ServerPathDirectoryCreateRequest = {
  parentPath: string;
  name: string;
};

export type ServerPathDirectoryCreateView = { path: string };

export type ServerPathReadView = {
  requestedPath: string;
  resolvedPath: string;
  kind: "text" | "markdown" | "binary";
  sizeBytes: number;
  startLine?: number;
  truncated: boolean;
  text?: string;
  languageHint?: string | null;
};

export type RuntimeConfigUpdate = {
  companion?: { enabled?: boolean };
  agents?: {
    defaults?: {
      contextTokens?: number;
      engine?: string;
      engineConfig?: Record<string, unknown>;
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

export type UiNcpSessionListView = { sessions: NcpSessionSummary[]; total: number };

export type UiNcpSessionMessagesView = {
  sessionId: string;
  status: NcpSessionStatus;
  messages: NcpMessage[];
  contextWindow?: NcpSessionSummary["contextWindow"];
  total: number;
  pageInfo: NcpSessionMessagePageInfo;
};

export type SessionTypeDescribeParams = {
  describeMode?: "observation" | "probe";
};

export type UiNcpSessionService = NcpSessionApi;

export type UiNcpAssetService = {
  put: (input: { fileName: string; mimeType?: string | null; bytes: Uint8Array; createdAt?: Date }) => Promise<UiNcpStoredAssetRecord>;
  stat: (uri: string) => Promise<UiNcpStoredAssetRecord | null> | UiNcpStoredAssetRecord | null;
  resolveContentPath: (uri: string) => string | null;
};

export type ConfigView = {
  companion?: { enabled?: boolean };
  agents: {
    defaults: {
      model: string;
      workspace?: string;
      engine?: string;
      engineConfig?: Record<string, unknown>;
      thinkingDefault?: ThinkingLevel;
      models?: AgentDefaultModelsView;
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
  modelConfig?: Record<
    string,
    {
      thinking?: { supported: ThinkingLevel[]; default?: ThinkingLevel | null };
      vision?: boolean;
    }
  >;
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

export type UiServerEvent = AppEvent;
