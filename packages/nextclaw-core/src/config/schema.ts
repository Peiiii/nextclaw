import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { FeishuConfigSchema as NextClawFeishuConfigSchema } from "@nextclaw/feishu-core";
import { findProviderByName, listProviderSpecs } from "../providers/registry.js";
import { DEFAULT_WORKSPACE_PATH } from "./brand.js";
import { expandHome, getPackageVersion } from "../utils/helpers.js";
import { applySensitiveHints, buildBaseHints, mapSensitivePaths, type ConfigUiHints } from "./schema.hints.js";
import { buildConfigActions, type ConfigActionManifest } from "./actions.js";

const allowFrom = z.array(z.string()).default([]);
const groupPolicySchema = z.enum(["open", "allowlist", "disabled"]);
const dmPolicySchema = z.enum(["pairing", "allowlist", "open", "disabled"]);
const ackReactionScopeSchema = z.enum(["off", "group-mentions", "group-all", "direct", "all"]);
const sessionDmScopeSchema = z.enum(["main", "per-peer", "per-channel-peer", "per-account-channel-peer"]);
const streamingModeSchema = z.union([z.boolean(), z.enum(["off", "partial", "block", "progress"])]).default("off");
const telegramStreamingModeSchema = z
  .union([z.boolean(), z.enum(["off", "partial", "block", "progress"])])
  .default("partial");
export const ThinkingLevelSchema = z.enum(["off", "minimal", "low", "medium", "high", "adaptive", "xhigh"]);
const providerModelThinkingSchema = z.object({
  supported: z.array(ThinkingLevelSchema).default([]),
  default: ThinkingLevelSchema.nullable().optional()
});
const discordDraftChunkSchema = z
  .object({
    minChars: z.number().int().default(200),
    maxChars: z.number().int().default(800),
    breakPreference: z.enum(["paragraph", "line", "none"]).default("paragraph")
  })
  .default({});

export const GroupRuleSchema = z.object({
  requireMention: z.boolean().default(false),
  mentionPatterns: z.array(z.string()).default([])
});

export const WhatsAppConfigSchema = z.object({
  enabled: z.boolean().default(false),
  bridgeUrl: z.string().default("ws://localhost:3001"),
  allowFrom: allowFrom
});

export const TelegramConfigSchema = z.object({
  enabled: z.boolean().default(false),
  token: z.string().default(""),
  allowFrom: allowFrom,
  proxy: z.string().nullable().default(null),
  ackReaction: z.string().default("👀"),
  ackReactionScope: ackReactionScopeSchema.default("all"),
  accountId: z.string().default("default"),
  dmPolicy: dmPolicySchema.default("open"),
  groupPolicy: groupPolicySchema.default("open"),
  groupAllowFrom: allowFrom,
  streaming: telegramStreamingModeSchema,
  requireMention: z.boolean().default(false),
  mentionPatterns: z.array(z.string()).default([]),
  groups: z.record(GroupRuleSchema).default({})
});

export const FeishuConfigSchema = NextClawFeishuConfigSchema;

export const DingTalkConfigSchema = z.object({
  enabled: z.boolean().default(false),
  clientId: z.string().default(""),
  clientSecret: z.string().default(""),
  allowFrom: allowFrom
});

export const WeComConfigSchema = z.object({
  enabled: z.boolean().default(false),
  corpId: z.string().default(""),
  agentId: z.string().default(""),
  secret: z.string().default(""),
  token: z.string().default(""),
  callbackPort: z.number().int().default(18890),
  callbackPath: z.string().default("/wecom/callback"),
  allowFrom: allowFrom
});

export const DiscordConfigSchema = z.object({
  enabled: z.boolean().default(false),
  token: z.string().default(""),
  allowBots: z.boolean().default(false),
  allowFrom: allowFrom,
  gatewayUrl: z.string().default("wss://gateway.discord.gg/?v=10&encoding=json"),
  intents: z.number().int().default(37377),
  proxy: z.string().nullable().default(null),
  mediaMaxMb: z.number().int().default(8),
  streaming: streamingModeSchema,
  draftChunk: discordDraftChunkSchema,
  textChunkLimit: z.number().int().default(2000),
  accountId: z.string().default("default"),
  dmPolicy: dmPolicySchema.default("open"),
  groupPolicy: groupPolicySchema.default("open"),
  groupAllowFrom: allowFrom,
  requireMention: z.boolean().default(false),
  mentionPatterns: z.array(z.string()).default([]),
  groups: z.record(GroupRuleSchema).default({})
});

export const EmailConfigSchema = z.object({
  enabled: z.boolean().default(false),
  consentGranted: z.boolean().default(false),
  imapHost: z.string().default(""),
  imapPort: z.number().int().default(993),
  imapUsername: z.string().default(""),
  imapPassword: z.string().default(""),
  imapMailbox: z.string().default("INBOX"),
  imapUseSsl: z.boolean().default(true),
  smtpHost: z.string().default(""),
  smtpPort: z.number().int().default(587),
  smtpUsername: z.string().default(""),
  smtpPassword: z.string().default(""),
  smtpUseTls: z.boolean().default(true),
  smtpUseSsl: z.boolean().default(false),
  fromAddress: z.string().default(""),
  autoReplyEnabled: z.boolean().default(true),
  pollIntervalSeconds: z.number().int().default(30),
  markSeen: z.boolean().default(true),
  maxBodyChars: z.number().int().default(12000),
  subjectPrefix: z.string().default("Re: "),
  allowFrom: allowFrom
});

export const MochatMentionSchema = z.object({
  requireInGroups: z.boolean().default(false)
});

export const MochatGroupRuleSchema = z.object({
  requireMention: z.boolean().default(false)
});

export const MochatConfigSchema = z.object({
  enabled: z.boolean().default(false),
  baseUrl: z.string().default("https://mochat.io"),
  socketUrl: z.string().default(""),
  socketPath: z.string().default("/socket.io"),
  socketDisableMsgpack: z.boolean().default(false),
  socketReconnectDelayMs: z.number().int().default(1000),
  socketMaxReconnectDelayMs: z.number().int().default(10000),
  socketConnectTimeoutMs: z.number().int().default(10000),
  refreshIntervalMs: z.number().int().default(30000),
  watchTimeoutMs: z.number().int().default(25000),
  watchLimit: z.number().int().default(100),
  retryDelayMs: z.number().int().default(500),
  maxRetryAttempts: z.number().int().default(0),
  clawToken: z.string().default(""),
  agentUserId: z.string().default(""),
  sessions: z.array(z.string()).default([]),
  panels: z.array(z.string()).default([]),
  allowFrom: allowFrom,
  mention: MochatMentionSchema.default({}),
  groups: z.record(MochatGroupRuleSchema).default({}),
  replyDelayMode: z.string().default("non-mention"),
  replyDelayMs: z.number().int().default(120000)
});

export const SlackDMSchema = z.object({
  enabled: z.boolean().default(true),
  policy: z.string().default("open"),
  allowFrom: allowFrom
});

export const SlackConfigSchema = z.object({
  enabled: z.boolean().default(false),
  mode: z.string().default("socket"),
  webhookPath: z.string().default("/slack/events"),
  botToken: z.string().default(""),
  appToken: z.string().default(""),
  userTokenReadOnly: z.boolean().default(true),
  allowBots: z.boolean().default(false),
  groupPolicy: z.string().default("mention"),
  groupAllowFrom: allowFrom,
  dm: SlackDMSchema.default({})
});

export const QQConfigSchema = z.object({
  enabled: z.boolean().default(false),
  appId: z.string().default(""),
  secret: z.string().default(""),
  markdownSupport: z.boolean().default(false),
  allowFrom: allowFrom
});

export const ChannelsConfigSchema = z.object({
  whatsapp: WhatsAppConfigSchema.default({}),
  telegram: TelegramConfigSchema.default({}),
  discord: DiscordConfigSchema.default({}),
  feishu: FeishuConfigSchema.default({}),
  mochat: MochatConfigSchema.default({}),
  dingtalk: DingTalkConfigSchema.default({}),
  wecom: WeComConfigSchema.default({}),
  email: EmailConfigSchema.default({}),
  slack: SlackConfigSchema.default({}),
  qq: QQConfigSchema.default({})
});

export const AgentDefaultsSchema = z.object({
  workspace: z.string().default(DEFAULT_WORKSPACE_PATH),
  model: z.string().default("dashscope/qwen3.5-flash"),
  engine: z.string().default("native"),
  engineConfig: z.record(z.unknown()).default({}),
  thinkingDefault: ThinkingLevelSchema.default("off"),
  models: z
    .record(
      z.object({
        params: z.record(z.unknown()).default({})
      }).passthrough()
    )
    .default({}),
  contextTokens: z.number().int().min(1000).default(200000),
  maxToolIterations: z.number().int().default(1000)
});

export const AgentProfileSchema = z.object({
  id: z.string().default("main"),
  default: z.boolean().default(false),
  workspace: z.string().optional(),
  model: z.string().optional(),
  engine: z.string().optional(),
  engineConfig: z.record(z.unknown()).optional(),
  thinkingDefault: ThinkingLevelSchema.optional(),
  models: z
    .record(
      z.object({
        params: z.record(z.unknown()).default({})
      }).passthrough()
    )
    .optional(),
  contextTokens: z.number().int().min(1000).optional(),
  maxToolIterations: z.number().int().optional()
});

export const BindingPeerSchema = z.object({
  kind: z.enum(["direct", "group", "channel"]),
  id: z.string()
});

export const BindingMatchSchema = z.object({
  channel: z.string(),
  accountId: z.string().optional(),
  peer: BindingPeerSchema.optional()
});

export const AgentBindingSchema = z.object({
  agentId: z.string(),
  match: BindingMatchSchema
});

export const SessionAgentToAgentSchema = z.object({
  maxPingPongTurns: z.number().int().min(0).max(5).default(0)
});

export const SessionConfigSchema = z.object({
  dmScope: sessionDmScopeSchema.default("per-channel-peer"),
  agentToAgent: SessionAgentToAgentSchema.default({})
});

export const ContextBootstrapSchema = z.object({
  files: z
    .array(z.string())
    .default([
      "AGENTS.md",
      "SOUL.md",
      "USER.md",
      "IDENTITY.md",
      "TOOLS.md",
      "BOOT.md",
      "BOOTSTRAP.md",
      "HEARTBEAT.md"
    ]),
  minimalFiles: z.array(z.string()).default(["AGENTS.md", "SOUL.md", "TOOLS.md", "IDENTITY.md"]),
  heartbeatFiles: z.array(z.string()).default(["HEARTBEAT.md"]),
  perFileChars: z.number().int().default(4000),
  totalChars: z.number().int().default(12000)
});

export const ContextMemorySchema = z.object({
  enabled: z.boolean().default(true),
  maxChars: z.number().int().default(8000)
});

export const ContextConfigSchema = z.object({
  bootstrap: ContextBootstrapSchema.default({}),
  memory: ContextMemorySchema.default({})
});

export const AgentsConfigSchema = z.object({
  defaults: AgentDefaultsSchema.default({}),
  context: ContextConfigSchema.default({}),
  list: z.array(AgentProfileSchema).default([])
});

export const ProviderConfigSchema = z.object({
  enabled: z.boolean().default(true),
  displayName: z.string().trim().max(80).default(""),
  apiKey: z.string().default(""),
  apiBase: z.string().nullable().default(null),
  extraHeaders: z.record(z.string()).nullable().default(null),
  wireApi: z.enum(["auto", "chat", "responses"]).default("auto"),
  models: z.array(z.string().trim().min(1)).default([]),
  modelThinking: z.record(providerModelThinkingSchema).default({})
});

export const ProvidersConfigSchema = z.record(ProviderConfigSchema).default({});

export const PluginEntrySchema = z.object({
  enabled: z.boolean().optional(),
  config: z.record(z.unknown()).optional()
});

export const PluginsLoadSchema = z.object({
  paths: z.array(z.string()).optional()
});

export const PluginInstallRecordSchema = z.object({
  source: z.enum(["npm", "archive", "path"]),
  spec: z.string().optional(),
  sourcePath: z.string().optional(),
  installPath: z.string().optional(),
  version: z.string().optional(),
  installedAt: z.string().optional()
});

export const PluginsConfigSchema = z.object({
  enabled: z.boolean().optional(),
  allow: z.array(z.string()).optional(),
  deny: z.array(z.string()).optional(),
  load: PluginsLoadSchema.optional(),
  entries: z.record(PluginEntrySchema).optional(),
  installs: z.record(PluginInstallRecordSchema).optional()
});

export const GatewayConfigSchema = z.object({
  host: z.string().default("0.0.0.0"),
  port: z.number().int().default(18790)
});

export const UiNcpRuntimeEntrySchema = z
  .object({
    enabled: z.boolean().optional()
  })
  .catchall(z.unknown());

export const UiNcpConfigSchema = z.object({
  runtimes: z.record(UiNcpRuntimeEntrySchema).default({})
});

export const UiConfigSchema = z.object({
  enabled: z.boolean().default(false),
  host: z.string().default("0.0.0.0"),
  port: z.number().int().default(55667),
  open: z.boolean().default(false),
  auth: z.object({
    enabled: z.boolean().default(false),
    username: z.string().default(""),
    passwordHash: z.string().default(""),
    passwordSalt: z.string().default("")
  }).default({}),
  ncp: UiNcpConfigSchema.default({})
});

export const RemoteConfigSchema = z.object({
  enabled: z.boolean().default(false),
  deviceName: z.string().default(""),
  platformApiBase: z.string().default(""),
  autoReconnect: z.boolean().default(true)
});

const mcpNamedStringSchema = z.string().trim().min(1);

export const McpServerScopeSchema = z.object({
  allAgents: z.boolean().default(false),
  agents: z.array(mcpNamedStringSchema).default([])
});

export const McpServerPolicySchema = z.object({
  trust: z.enum(["explicit"]).default("explicit"),
  start: z.enum(["eager"]).default("eager")
});

export const McpTransportStdioSchema = z.object({
  type: z.literal("stdio"),
  command: mcpNamedStringSchema,
  args: z.array(z.string()).default([]),
  cwd: z.string().optional(),
  env: z.record(z.string()).default({}),
  stderr: z.enum(["inherit", "pipe", "ignore"]).default("pipe")
});

export const McpTransportHttpSchema = z.object({
  type: z.literal("http"),
  url: z.string().url(),
  headers: z.record(z.string()).default({}),
  timeoutMs: z.number().int().min(1).max(120000).default(15000),
  verifyTls: z.boolean().default(true)
});

export const McpTransportSseReconnectSchema = z.object({
  enabled: z.boolean().default(true),
  initialDelayMs: z.number().int().min(100).max(120000).default(1000),
  maxDelayMs: z.number().int().min(100).max(300000).default(30000)
});

export const McpTransportSseSchema = z.object({
  type: z.literal("sse"),
  url: z.string().url(),
  headers: z.record(z.string()).default({}),
  timeoutMs: z.number().int().min(1).max(120000).default(15000),
  verifyTls: z.boolean().default(true),
  reconnect: McpTransportSseReconnectSchema.default({})
});

export const McpTransportSchema = z.discriminatedUnion("type", [
  McpTransportStdioSchema,
  McpTransportHttpSchema,
  McpTransportSseSchema
]);

export const McpServerMetadataSchema = z.object({
  source: z.enum(["manual", "marketplace"]).optional(),
  catalogSlug: z.string().optional(),
  catalogVersion: z.string().optional(),
  displayName: z.string().optional(),
  vendor: z.string().optional(),
  docsUrl: z.string().url().optional(),
  homepage: z.string().url().optional(),
  trustLevel: z.enum(["official", "verified", "community"]).optional(),
  installedAt: z.string().optional()
});

export const McpServerDefinitionSchema = z.object({
  enabled: z.boolean().default(true),
  transport: McpTransportSchema,
  scope: McpServerScopeSchema.default({}),
  policy: McpServerPolicySchema.default({}),
  metadata: McpServerMetadataSchema.optional()
});

export const McpConfigSchema = z.object({
  servers: z.record(McpServerDefinitionSchema).default({})
});

export const WebSearchConfigSchema = z.object({
  apiKey: z.string().default(""),
  maxResults: z.number().int().default(5)
});

export const SearchProviderNameSchema = z.enum(["bocha", "brave"]);
export const BochaSearchFreshnessSchema = z.enum(["noLimit", "oneDay", "oneWeek", "oneMonth", "oneYear"]);

export const SearchDefaultsConfigSchema = z.object({
  maxResults: z.number().int().min(1).max(50).default(5)
});

export const BochaSearchProviderConfigSchema = z.object({
  apiKey: z.string().default(""),
  baseUrl: z.string().default("https://api.bocha.cn/v1/web-search"),
  summary: z.boolean().default(true),
  freshness: BochaSearchFreshnessSchema.default("noLimit"),
  docsUrl: z.string().default("https://open.bocha.cn")
});

export const BraveSearchProviderConfigSchema = z.object({
  apiKey: z.string().default(""),
  baseUrl: z.string().default("https://api.search.brave.com/res/v1/web/search")
});

export const SearchConfigSchema = z.object({
  provider: SearchProviderNameSchema.default("bocha"),
  enabledProviders: z.array(SearchProviderNameSchema).default(["bocha"]),
  defaults: SearchDefaultsConfigSchema.default({}),
  providers: z
    .object({
      bocha: BochaSearchProviderConfigSchema.default({}),
      brave: BraveSearchProviderConfigSchema.default({})
    })
    .default({})
});

export const WebToolsConfigSchema = z.object({
  search: WebSearchConfigSchema.default({})
});

export const ExecToolConfigSchema = z.object({
  timeout: z.number().int().default(60)
});

export const ToolsConfigSchema = z.object({
  web: WebToolsConfigSchema.default({}),
  exec: ExecToolConfigSchema.default({}),
  restrictToWorkspace: z.boolean().default(false)
});

export const SecretSourceSchema = z.enum(["env", "file", "exec"]);

export const SecretRefSchema = z.object({
  source: SecretSourceSchema,
  provider: z.string().optional(),
  id: z.string().min(1)
});

export const SecretProviderEnvSchema = z.object({
  source: z.literal("env"),
  prefix: z.string().optional()
});

export const SecretProviderFileSchema = z.object({
  source: z.literal("file"),
  path: z.string(),
  format: z.enum(["json"]).default("json")
});

export const SecretProviderExecSchema = z.object({
  source: z.literal("exec"),
  command: z.string(),
  args: z.array(z.string()).default([]),
  cwd: z.string().optional(),
  timeoutMs: z.number().int().min(1).max(60000).default(5000)
});

export const SecretProviderSchema = z.discriminatedUnion("source", [
  SecretProviderEnvSchema,
  SecretProviderFileSchema,
  SecretProviderExecSchema
]);

export const SecretDefaultsSchema = z.object({
  env: z.string().optional(),
  file: z.string().optional(),
  exec: z.string().optional()
});

export const SecretsConfigSchema = z.object({
  enabled: z.boolean().default(true),
  defaults: SecretDefaultsSchema.default({}),
  providers: z.record(SecretProviderSchema).default({}),
  refs: z.record(SecretRefSchema).default({})
});

export const ConfigSchema = z.object({
  agents: AgentsConfigSchema.default({}),
  channels: ChannelsConfigSchema.default({}),
  providers: ProvidersConfigSchema.default({}),
  search: SearchConfigSchema.default({}),
  mcp: McpConfigSchema.default({}),
  plugins: PluginsConfigSchema.default({}),
  bindings: z.array(AgentBindingSchema).default([]),
  session: SessionConfigSchema.default({}),
  gateway: GatewayConfigSchema.default({}),
  ui: UiConfigSchema.default({}),
  remote: RemoteConfigSchema.default({}),
  tools: ToolsConfigSchema.default({}),
  secrets: SecretsConfigSchema.default({})
});

export type ConfigSchemaJson = Record<string, unknown>;

export type ConfigSchemaResponse = {
  schema: ConfigSchemaJson;
  uiHints: ConfigUiHints;
  actions: ConfigActionManifest[];
  version: string;
  generatedAt: string;
};

export type Config = z.infer<typeof ConfigSchema>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type SecretRef = z.infer<typeof SecretRefSchema>;
export type SecretSource = z.infer<typeof SecretSourceSchema>;
export type SecretProviderConfig = z.infer<typeof SecretProviderSchema>;
export type SecretsConfig = z.infer<typeof SecretsConfigSchema>;
export type SearchConfig = z.infer<typeof SearchConfigSchema>;
export type SearchProviderName = z.infer<typeof SearchProviderNameSchema>;
export type McpConfig = z.infer<typeof McpConfigSchema>;
export type McpServerDefinition = z.infer<typeof McpServerDefinitionSchema>;
export type McpServerMetadata = z.infer<typeof McpServerMetadataSchema>;
export type McpServerScope = z.infer<typeof McpServerScopeSchema>;
export type McpServerPolicy = z.infer<typeof McpServerPolicySchema>;
export type McpTransport = z.infer<typeof McpTransportSchema>;
export type McpTransportStdio = z.infer<typeof McpTransportStdioSchema>;
export type McpTransportHttp = z.infer<typeof McpTransportHttpSchema>;
export type McpTransportSse = z.infer<typeof McpTransportSseSchema>;

export function getWorkspacePathFromConfig(config: Config): string {
  return expandHome(config.agents.defaults.workspace);
}

export function matchProvider(config: Config, model?: string): { provider: ProviderConfig | null; name: string | null } {
  const providers = config.providers as Record<string, ProviderConfig>;
  const providerSpecs = listProviderSpecs();
  const rawModel = String(model ?? config.agents.defaults.model ?? "").trim();
  const modelLower = rawModel.toLowerCase();
  const modelPrefix = modelLower.includes("/") ? modelLower.slice(0, modelLower.indexOf("/")) : "";
  let prefixedMatch: { provider: ProviderConfig; name: string } | null = null;
  if (modelPrefix) {
    for (const [name, provider] of Object.entries(providers)) {
      if (name.toLowerCase() === modelPrefix) {
        if (provider.enabled !== false) {
          prefixedMatch = { provider, name };
        }
        if (provider.enabled !== false && provider.apiKey) {
          return { provider, name };
        }
        break;
      }
    }
  }

  const builtinProviderNames = new Set(providerSpecs.map((spec) => spec.name));
  for (const spec of providerSpecs) {
    const provider = providers[spec.name];
    if (provider && provider.enabled !== false && provider.apiKey && spec.keywords.some((kw) => modelLower.includes(kw))) {
      return { provider, name: spec.name };
    }
  }
  for (const spec of providerSpecs) {
    const provider = providers[spec.name];
    if (provider && provider.enabled !== false && provider.apiKey) {
      return { provider, name: spec.name };
    }
  }
  for (const [name, provider] of Object.entries(providers)) {
    if (builtinProviderNames.has(name)) {
      continue;
    }
    if (provider.enabled !== false && provider.apiKey) {
      return { provider, name };
    }
  }
  if (prefixedMatch) {
    return { provider: prefixedMatch.provider, name: prefixedMatch.name };
  }
  return { provider: null, name: null };
}

export function getProvider(config: Config, model?: string): ProviderConfig | null {
  return matchProvider(config, model).provider;
}

export function getProviderName(config: Config, model?: string): string | null {
  return matchProvider(config, model).name;
}

export function getApiKey(config: Config, model?: string): string | null {
  const provider = getProvider(config, model);
  return provider?.apiKey ?? null;
}

export function getApiBase(config: Config, model?: string): string | null {
  const { provider, name } = matchProvider(config, model);
  if (provider?.apiBase) {
    return provider.apiBase;
  }
  if (name) {
    const spec = findProviderByName(name);
    if (spec?.defaultApiBase) {
      return spec.defaultApiBase;
    }
  }
  return null;
}

export function buildConfigSchema(options?: { version?: string }): ConfigSchemaResponse {
  const baseSchema = zodToJsonSchema(ConfigSchema, {
    name: "NextClawConfig",
    target: "jsonSchema7"
  }) as ConfigSchemaJson;
  if (baseSchema && typeof baseSchema === "object") {
    baseSchema.title = "NextClawConfig";
  }

  const baseHints = mapSensitivePaths(ConfigSchema, "", buildBaseHints());
  const mergedHints = applySensitiveHints(baseHints);

  return {
    schema: baseSchema,
    uiHints: mergedHints,
    actions: buildConfigActions(),
    version: options?.version ?? getPackageVersion(),
    generatedAt: new Date().toISOString()
  };
}
