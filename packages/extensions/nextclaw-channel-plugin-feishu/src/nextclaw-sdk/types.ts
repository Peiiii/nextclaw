export type LogFn = (message: string) => void;

export type SecretRefSource = "env" | "file" | "exec";

export type SecretRef = {
  source: SecretRefSource;
  provider: string;
  id: string;
};

export type SecretInput = string | SecretRef;

export type DmPolicy = "open" | "pairing" | "allowlist";
export type GroupPolicy = "open" | "allowlist" | "disabled";

export type AllowlistMatch<TSource extends string = string> = {
  allowed: boolean;
  matchKey?: string;
  matchSource?: TSource;
};

export type BaseProbeResult<TTarget = string> = {
  ok: boolean;
  target?: TTarget;
  error?: string;
  [key: string]: unknown;
};

export type ReplyPayload = {
  text?: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  [key: string]: unknown;
};

export type HistoryEntry = {
  sender: string;
  body: string;
  timestamp?: number;
  messageId?: string;
};

export type GroupToolPolicyConfig = Record<string, unknown>;

export type ChannelGroupContext = {
  cfg: ClawdbotConfig;
  groupId?: string | null;
  [key: string]: unknown;
};

export type ChannelMeta = {
  id: string;
  label: string;
  selectionLabel?: string;
  docsPath?: string;
  docsLabel?: string;
  blurb?: string;
  aliases?: string[];
  order?: number;
  [key: string]: unknown;
};

export type ChannelPlugin<ResolvedAccount = unknown> = {
  id: string;
  meta: ChannelMeta;
  config?: Record<string, unknown>;
  onboarding?: ChannelOnboardingAdapter;
  [key: string]: unknown;
  __resolvedAccountType__?: ResolvedAccount;
};

export type ChannelOutboundAdapter = Record<string, unknown>;

export type AnyAgentTool = {
  name?: string;
  description?: string;
  parameters?: Record<string, unknown>;
  execute?: (toolCallId: string, params: unknown) => Promise<unknown> | unknown;
  [key: string]: unknown;
};

export type ResolvedAgentRoute = {
  agentId?: string;
  sessionKey?: string;
  [key: string]: unknown;
};

export type InboundDebouncer<T> = {
  run: (key: string, value: T, task: (value: T) => Promise<void>) => void;
  clear: () => void;
};

export type PluginRuntime = {
  version?: string;
  config: {
    loadConfig?: () => OpenClawConfig;
    writeConfigFile: (next: OpenClawConfig) => Promise<void>;
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
      ) => Promise<{ path: string; contentType?: string }>;
    };
    text: {
      chunkMarkdownText: (text: string, limit: number) => string[];
      resolveMarkdownTableMode: (params: Record<string, unknown>) => unknown;
      convertMarkdownTables: (text: string, mode?: unknown) => string;
      resolveTextChunkLimit: (
        cfg: OpenClawConfig,
        channel: string,
        accountId?: string,
        options?: Record<string, unknown>,
      ) => number;
      resolveChunkMode: (cfg: OpenClawConfig, channel: string) => string;
      chunkTextWithMode: (text: string, limit: number, mode?: unknown) => string[];
      hasControlCommand: (text: string, cfg: OpenClawConfig) => boolean;
    };
    reply: {
      resolveEnvelopeFormatOptions: (cfg: OpenClawConfig) => Record<string, unknown>;
      formatAgentEnvelope: (params: Record<string, unknown>) => string;
      finalizeInboundContext: (params: Record<string, unknown>) => Record<string, unknown>;
      withReplyDispatcher: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
      dispatchReplyFromConfig: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
      createReplyDispatcherWithTyping: (params: Record<string, unknown>) => {
        dispatcher: unknown;
        replyOptions: Record<string, unknown>;
        markDispatchIdle: () => void;
      };
      resolveHumanDelayConfig: (cfg: OpenClawConfig, agentId: string) => unknown;
      dispatchReplyWithBufferedBlockDispatcher?: (
        params: Record<string, unknown>,
      ) => Promise<void>;
    };
    routing: {
      resolveAgentRoute: (params: Record<string, unknown>) => ResolvedAgentRoute | null;
    };
    pairing: {
      readAllowFromStore: (params: { channel: string; accountId?: string }) => unknown;
      upsertPairingRequest: (params: Record<string, unknown>) => Promise<{
        code: string;
        created: boolean;
      }>;
    };
    commands: {
      shouldComputeCommandAuthorized: (text: string) => boolean;
      resolveCommandAuthorizedFromAuthorizers: (
        params: Record<string, unknown>,
      ) => Promise<boolean> | boolean;
    };
    debounce: {
      resolveInboundDebounceMs: (params: Record<string, unknown>) => number;
      createInboundDebouncer: <T>(params: Record<string, unknown>) => InboundDebouncer<T>;
    };
  };
  [key: string]: unknown;
};

export type RuntimeEnv = {
  log?: (message: string) => void;
  error?: (message: string) => void;
  warn?: (message: string) => void;
  debug?: (message: string) => void;
  info?: (message: string) => void;
  [key: string]: unknown;
};

export type OpenClawPluginApi = {
  config: ClawdbotConfig;
  runtime: PluginRuntime;
  logger: {
    info: LogFn;
    warn: LogFn;
    error: LogFn;
    debug?: LogFn;
  };
  registerTool: (
    tool:
      | AnyAgentTool
      | ((ctx: Record<string, unknown>) => AnyAgentTool | AnyAgentTool[] | null | undefined),
    opts?: { name?: string; names?: string[]; optional?: boolean },
  ) => void;
  registerChannel: (registration: unknown) => void;
  [key: string]: unknown;
};

export type WizardSelectOption<T extends string = string> = {
  value: T;
  label: string;
  hint?: string;
};

export type WizardPrompter = {
  note: (message: string, title?: string) => Promise<void>;
  text: (params: {
    message: string;
    placeholder?: string;
    initialValue?: string;
    validate?: (value: string) => string | undefined;
  }) => Promise<string>;
  confirm: (params: { message: string; initialValue?: boolean }) => Promise<boolean>;
  select: <T extends string = string>(params: {
    message: string;
    options: WizardSelectOption<T>[];
    initialValue?: T | string;
  }) => Promise<T>;
};

export type ChannelOnboardingDmPolicy = {
  label: string;
  channel: string;
  policyKey: string;
  allowFromKey: string;
  getCurrent: (cfg: ClawdbotConfig) => DmPolicy;
  setPolicy: (cfg: ClawdbotConfig, policy: DmPolicy) => ClawdbotConfig;
  promptAllowFrom: (params: {
    cfg: ClawdbotConfig;
    prompter: WizardPrompter;
  }) => Promise<ClawdbotConfig>;
};

export type ChannelOnboardingAdapter = {
  channel: string;
  getStatus: (params: { cfg: ClawdbotConfig }) => Promise<{
    channel: string;
    configured: boolean;
    statusLines: string[];
    selectionHint?: string;
    quickstartScore?: number;
  }>;
  configure: (params: {
    cfg: ClawdbotConfig;
    prompter: WizardPrompter;
  }) => Promise<{ cfg: ClawdbotConfig; accountId?: string }>;
  dmPolicy?: ChannelOnboardingDmPolicy;
  disable?: (cfg: ClawdbotConfig) => ClawdbotConfig;
};

export type OpenClawConfig = {
  channels?: Record<string, Record<string, unknown> | undefined>;
  bindings?: Array<{
    agentId?: string;
    match?: {
      channel?: string;
      peer?: {
        kind?: string;
        id?: string;
      };
    };
  }>;
  agents?: {
    list?: Array<{
      id: string;
      workspace?: string;
      agentDir?: string;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  };
  broadcast?: Record<string, string[]>;
  secrets?: {
    defaults?: {
      env?: string;
      file?: string;
      exec?: string;
    };
    providers?: Record<
      string,
      {
        source?: SecretRefSource;
        path?: string;
        mode?: "singleValue" | "json";
        command?: string;
        args?: string[];
        [key: string]: unknown;
      }
    >;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type ClawdbotConfig = OpenClawConfig;
