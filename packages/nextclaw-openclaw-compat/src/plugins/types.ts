import type { AgentEngineFactory, Config, ExtensionChannel } from "@nextclaw/core";
import type { NcpAgentRuntime } from "@nextclaw/ncp";
import type { RuntimeFactoryParams } from "@nextclaw/ncp-toolkit";

export type PluginConfigUiHint = {
  label?: string;
  help?: string;
  advanced?: boolean;
  sensitive?: boolean;
  placeholder?: string;
};

export type PluginKind = string;

export type PluginManifest = {
  id: string;
  configSchema: Record<string, unknown>;
  kind?: PluginKind;
  channels?: string[];
  providers?: string[];
  skills?: string[];
  name?: string;
  description?: string;
  version?: string;
  uiHints?: Record<string, PluginConfigUiHint>;
};

export type PluginManifestLoadResult =
  | { ok: true; manifest: PluginManifest; manifestPath: string }
  | { ok: false; error: string; manifestPath: string };

export type OpenClawPluginTool = {
  label?: string;
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
  execute:
    | ((toolCallId: string, params: Record<string, unknown>) => Promise<unknown> | unknown)
    | ((params: Record<string, unknown>) => Promise<unknown> | unknown);
};

export type OpenClawPluginToolContext = {
  config?: Config;
  workspaceDir?: string;
  sessionKey?: string;
  channel?: string;
  chatId?: string;
  sandboxed?: boolean;
};

export type OpenClawPluginToolFactory = (
  ctx: OpenClawPluginToolContext,
) => OpenClawPluginTool | OpenClawPluginTool[] | null | undefined;

export type OpenClawPluginToolOptions = {
  name?: string;
  names?: string[];
  optional?: boolean;
};

export type OpenClawPluginEngineOptions = {
  kind: string;
};

export type OpenClawPluginNcpAgentRuntimeRegistration = {
  kind: string;
  label?: string;
  createRuntime: (params: RuntimeFactoryParams) => NcpAgentRuntime;
  describeSessionType?: (params?: {
    describeMode?: "observation" | "probe";
  }) =>
    | Promise<{
        ready?: boolean;
        reason?: string | null;
        reasonMessage?: string | null;
        supportedModels?: string[];
        recommendedModel?: string | null;
        cta?: {
          kind: string;
          label?: string;
          href?: string;
        } | null;
      } | null | undefined>
    | {
        ready?: boolean;
        reason?: string | null;
        reasonMessage?: string | null;
        supportedModels?: string[];
        recommendedModel?: string | null;
        cta?: {
          kind: string;
          label?: string;
          href?: string;
        } | null;
      }
    | null
    | undefined;
};

export type OpenClawProviderPlugin = {
  id: string;
  label?: string;
  docsPath?: string;
  aliases?: string[];
  envVars?: string[];
  models?: Record<string, unknown>;
  auth?: Array<Record<string, unknown>>;
};

export type OpenClawChannelConfigSchema = {
  schema: Record<string, unknown>;
  uiHints?: Record<string, PluginConfigUiHint>;
};

export type OpenClawChannelSetup = {
  validateInput?: (params: {
    cfg: Record<string, unknown>;
    input: unknown;
    accountId?: string | null;
  }) => string | null;
  applyAccountConfig?: (params: {
    cfg: Record<string, unknown>;
    input: unknown;
    accountId?: string | null;
  }) => Record<string, unknown>;
};

export type OpenClawChannelGatewayStartContext = {
  cfg?: Config;
  accountId?: string | null;
  channelId?: string;
  abortSignal?: AbortSignal;
  runtime?: Record<string, unknown>;
  setStatus?: (status: Record<string, unknown>) => void;
  log?: {
    debug?: (message: string) => void;
    info?: (message: string) => void;
    warn?: (message: string) => void;
    error?: (message: string) => void;
  };
};

export type OpenClawChannelGateway = {
  startAccount?: (
    ctx: OpenClawChannelGatewayStartContext,
  ) =>
    | Promise<
        | void
        | {
            stop?: () => void | Promise<void>;
          }
      >
    | void
    | {
        stop?: () => void | Promise<void>;
      };
};

export type OpenClawChannelConfigAdapter = {
  listAccountIds?: (cfg?: Record<string, unknown>) => string[];
  defaultAccountId?: (cfg?: Record<string, unknown>) => string;
};

export type OpenClawChannelAgentPrompt = {
  messageToolHints?: (params: { cfg: Config; accountId?: string | null }) => string[];
};

export type OpenClawChannelAuthLoginResult = {
  pluginConfig: Record<string, unknown>;
  accountId?: string | null;
  notes?: string[];
};

export type OpenClawChannelAuthStartResult = {
  channel: string;
  kind: "qr_code";
  sessionId: string;
  qrCode: string;
  qrCodeUrl: string;
  expiresAt: string;
  intervalMs: number;
  note?: string;
};

export type OpenClawChannelAuthPollResult = {
  channel: string;
  status: "pending" | "scanned" | "authorized" | "expired" | "error";
  message?: string;
  nextPollMs?: number;
  accountId?: string | null;
  notes?: string[];
  pluginConfig?: Record<string, unknown>;
};

export type OpenClawChannelAuth = {
  login?: (params: {
    cfg: Config;
    pluginId: string;
    channelId: string;
    pluginConfig?: Record<string, unknown>;
    accountId?: string | null;
    baseUrl?: string | null;
    verbose?: boolean;
    }) =>
    | Promise<OpenClawChannelAuthLoginResult>
    | OpenClawChannelAuthLoginResult;
  start?: (params: {
    cfg: Config;
    pluginId: string;
    channelId: string;
    pluginConfig?: Record<string, unknown>;
    accountId?: string | null;
    baseUrl?: string | null;
  }) =>
    | Promise<OpenClawChannelAuthStartResult>
    | OpenClawChannelAuthStartResult;
  poll?: (params: {
    cfg: Config;
    pluginId: string;
    channelId: string;
    pluginConfig?: Record<string, unknown>;
    sessionId: string;
  }) =>
    | Promise<OpenClawChannelAuthPollResult | null>
    | OpenClawChannelAuthPollResult
    | null;
};

export type OpenClawChannelPlugin = {
  id: string;
  meta?: Record<string, unknown>;
  capabilities?: Record<string, unknown>;
  nextclaw?: ExtensionChannel["nextclaw"];
  configSchema?: OpenClawChannelConfigSchema;
  config?: OpenClawChannelConfigAdapter;
  setup?: OpenClawChannelSetup;
  gateway?: OpenClawChannelGateway;
  agentTools?: OpenClawPluginTool[] | (() => OpenClawPluginTool | OpenClawPluginTool[] | null | undefined);
  agentPrompt?: OpenClawChannelAgentPrompt;
  auth?: OpenClawChannelAuth;
  outbound?: {
    sendText?: (ctx: {
      cfg: Config;
      to: string;
      text: string;
      accountId?: string | null;
    }) => Promise<unknown> | unknown;
    sendPayload?: (ctx: {
      cfg: Config;
      to: string;
      text: string;
      payload: unknown;
      accountId?: string | null;
    }) => Promise<unknown> | unknown;
  };
};

export type OpenClawPluginChannelRegistration =
  | OpenClawChannelPlugin
  | {
      plugin: OpenClawChannelPlugin;
    };

export type OpenClawPluginDefinition = {
  id?: string;
  name?: string;
  description?: string;
  version?: string;
  kind?: PluginKind;
  configSchema?: Record<string, unknown>;
  register?: (api: OpenClawPluginApi) => void | Promise<void>;
  activate?: (api: OpenClawPluginApi) => void | Promise<void>;
};

export type OpenClawPluginModule =
  | OpenClawPluginDefinition
  | ((api: OpenClawPluginApi) => void | Promise<void>);

export type PluginLogger = {
  debug?: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

export type PluginOrigin = "bundled" | "global" | "workspace" | "config";

export type PluginDiagnostic = {
  level: "warn" | "error";
  message: string;
  pluginId?: string;
  source?: string;
};

export type PluginRecord = {
  id: string;
  name: string;
  version?: string;
  description?: string;
  kind?: PluginKind;
  source: string;
  origin: PluginOrigin;
  workspaceDir?: string;
  enabled: boolean;
  status: "loaded" | "disabled" | "error";
  error?: string;
  toolNames: string[];
  channelIds: string[];
  providerIds: string[];
  engineKinds: string[];
  ncpAgentRuntimeKinds: string[];
  configSchema: boolean;
  configUiHints?: Record<string, PluginConfigUiHint>;
  configJsonSchema?: Record<string, unknown>;
};

export type PluginToolRegistration = {
  pluginId: string;
  factory: OpenClawPluginToolFactory;
  names: string[];
  optional: boolean;
  source: string;
};

export type PluginChannelRegistration = {
  pluginId: string;
  channel: OpenClawChannelPlugin;
  source: string;
};

export type PluginProviderRegistration = {
  pluginId: string;
  provider: OpenClawProviderPlugin;
  source: string;
};

export type PluginEngineRegistration = {
  pluginId: string;
  kind: string;
  factory: AgentEngineFactory;
  source: string;
};

export type PluginNcpAgentRuntimeRegistration = {
  pluginId: string;
  kind: string;
  label: string;
  createRuntime: (params: RuntimeFactoryParams) => NcpAgentRuntime;
  describeSessionType?: OpenClawPluginNcpAgentRuntimeRegistration["describeSessionType"];
  source: string;
};

export type PluginReplyDispatchParams = {
  ctx: {
    Body?: string;
    BodyForAgent?: string;
    BodyForCommands?: string;
    ChatType?: string;
    SenderId?: string;
    SenderName?: string;
    SessionKey?: string;
    AccountId?: string;
    OriginatingChannel?: string;
    OriginatingTo?: string;
    Provider?: string;
    Surface?: string;
    [key: string]: unknown;
  };
  cfg?: unknown;
  dispatcherOptions: {
    deliver: (replyPayload: { text?: string }, info: { kind: string }) => Promise<void> | void;
    onError?: (error: unknown) => void;
  };
};

export type PluginRuntime = {
  version: string;
  config: {
    loadConfig: () => Record<string, unknown>;
    writeConfigFile: (next: Record<string, unknown>) => Promise<void>;
  };
  logging: {
    shouldLogVerbose: () => boolean;
  };
  media: {
    detectMime: (params: { buffer: Buffer }) => Promise<string | undefined>;
    loadWebMedia: (
      url: string,
      options?: Record<string, unknown>,
    ) => Promise<Record<string, unknown>>;
  };
  tools: {
    createMemorySearchTool: (params: {
      config?: Config;
      agentSessionKey?: string;
    }) => OpenClawPluginTool | null;
    createMemoryGetTool: (params: {
      config?: Config;
      agentSessionKey?: string;
    }) => OpenClawPluginTool | null;
  };
  channel: {
    media: {
      fetchRemoteMedia: (params: {
        url: string;
        maxBytes?: number;
      }) => Promise<Record<string, unknown>>;
      saveMediaBuffer: (
        buffer: Buffer,
        contentType?: string,
        direction?: string,
        maxBytes?: number,
        fileName?: string,
      ) => Promise<{ path: string; contentType?: string }>;
    };
    text: {
      chunkMarkdownText: (text: string, limit: number) => string[];
      resolveMarkdownTableMode: (params: Record<string, unknown>) => unknown;
      convertMarkdownTables: (text: string, mode?: unknown) => string;
      resolveTextChunkLimit: (
        cfg: Config,
        channel: string,
        accountId?: string,
        options?: Record<string, unknown>,
      ) => number;
      resolveChunkMode: (cfg: Config, channel: string, accountId?: string) => string;
      chunkTextWithMode: (text: string, limit: number, mode?: unknown) => string[];
      hasControlCommand: (text: string, cfg?: Config) => boolean;
    };
    reply: {
      resolveEnvelopeFormatOptions: (cfg: Config) => Record<string, unknown>;
      formatAgentEnvelope: (params: Record<string, unknown>) => string;
      finalizeInboundContext: (params: Record<string, unknown>) => Record<string, unknown>;
      withReplyDispatcher: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
      dispatchReplyFromConfig: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
      createReplyDispatcherWithTyping: (params: Record<string, unknown>) => {
        dispatcher: {
          sendToolResult: (payload: Record<string, unknown>) => boolean;
          sendBlockReply: (payload: Record<string, unknown>) => boolean;
          sendFinalReply: (payload: Record<string, unknown>) => boolean;
          waitForIdle: () => Promise<void>;
          getQueuedCounts: () => Record<string, number>;
          markComplete: () => void;
        };
        replyOptions: Record<string, unknown>;
        markDispatchIdle: () => void;
      };
      resolveHumanDelayConfig: (cfg: Config, agentId: string) => unknown;
      dispatchReplyWithBufferedBlockDispatcher: (params: PluginReplyDispatchParams) => Promise<void>;
    };
    routing: {
      resolveAgentRoute: (params: Record<string, unknown>) => Record<string, unknown>;
    };
    pairing: {
      readAllowFromStore: (params: { channel: string; accountId?: string }) => Promise<string[]>;
      upsertPairingRequest: (params: Record<string, unknown>) => Promise<{
        code: string;
        created: boolean;
      }>;
    };
    commands: {
      shouldComputeCommandAuthorized: (text: string, cfg?: Config) => boolean;
      resolveCommandAuthorizedFromAuthorizers: (params: Record<string, unknown>) => boolean;
    };
    debounce: {
      resolveInboundDebounceMs: (params: Record<string, unknown>) => number;
      createInboundDebouncer: <T>(params: Record<string, unknown>) => {
        enqueue: (item: T) => Promise<void>;
        flushKey: (key: string) => Promise<void>;
      };
    };
  };
};

export type OpenClawPluginApi = {
  id: string;
  name: string;
  version?: string;
  description?: string;
  source: string;
  config: Config;
  pluginConfig?: Record<string, unknown>;
  runtime: PluginRuntime;
  logger: PluginLogger;
  registerTool: (
    tool: OpenClawPluginTool | OpenClawPluginToolFactory,
    opts?: OpenClawPluginToolOptions,
  ) => void;
  registerChannel: (registration: OpenClawPluginChannelRegistration) => void;
  registerProvider: (provider: OpenClawProviderPlugin) => void;
  registerEngine: (factory: AgentEngineFactory, opts: OpenClawPluginEngineOptions) => void;
  registerNcpAgentRuntime: (registration: OpenClawPluginNcpAgentRuntimeRegistration) => void;
  registerHook: (_events: string | string[], _handler: unknown, _opts?: unknown) => void;
  registerGatewayMethod: (_method: string, _handler: unknown) => void;
  registerCli: (_registrar: unknown, _opts?: unknown) => void;
  registerService: (_service: unknown) => void;
  registerCommand: (_command: unknown) => void;
  registerHttpHandler: (_handler: unknown) => void;
  registerHttpRoute: (_params: { path: string; handler: unknown }) => void;
  resolvePath: (input: string) => string;
};

export type PluginRegistry = {
  plugins: PluginRecord[];
  tools: PluginToolRegistration[];
  channels: PluginChannelRegistration[];
  providers: PluginProviderRegistration[];
  engines: PluginEngineRegistration[];
  ncpAgentRuntimes: PluginNcpAgentRuntimeRegistration[];
  diagnostics: PluginDiagnostic[];
  resolvedTools: OpenClawPluginTool[];
};

export type PluginUiMetadata = {
  id: string;
  configSchema?: Record<string, unknown>;
  configUiHints?: Record<string, PluginConfigUiHint>;
};
