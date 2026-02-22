import {
  loadConfig,
  saveConfig,
  ConfigSchema,
  probeFeishu,
  type Config,
  type ConfigActionExecuteRequest,
  type ConfigActionExecuteResult,
  type ConfigActionManifest,
  type ConfigUiHint,
  type ConfigUiHints,
  type ProviderConfig,
  PROVIDERS,
  buildConfigSchema,
  findProviderByName,
  getPackageVersion,
  isSensitiveConfigPath,
  type ProviderSpec,
  SessionManager,
  getWorkspacePathFromConfig
} from "@nextclaw/core";
import type {
  ConfigMetaView,
  RuntimeConfigUpdate,
  ConfigSchemaResponse,
  ConfigView,
  ProviderConfigUpdate,
  ProviderConfigView,
  SessionsListView,
  SessionHistoryView,
  SessionPatchUpdate
} from "./types.js";

const MASK_MIN_LENGTH = 8;
const EXTRA_SENSITIVE_PATH_PATTERNS = [/authorization/i, /cookie/i, /session/i, /bearer/i];

type ExecuteActionResult =
  | { ok: true; data: ConfigActionExecuteResult }
  | { ok: false; code: string; message: string; details?: Record<string, unknown> };

type ActionHandler = (
  params: {
    config: Config;
    action: ConfigActionManifest;
  }
) => Promise<ConfigActionExecuteResult>;

function matchesExtraSensitivePath(path: string): boolean {
  if (path === "session" || path.startsWith("session.")) {
    return false;
  }
  return EXTRA_SENSITIVE_PATH_PATTERNS.some((pattern) => pattern.test(path));
}

function matchHint(path: string, hints: ConfigUiHints): ConfigUiHint | undefined {
  const direct = hints[path];
  if (direct) {
    return direct;
  }
  const segments = path.split(".");
  for (const [hintKey, hint] of Object.entries(hints)) {
    if (!hintKey.includes("*")) {
      continue;
    }
    const hintSegments = hintKey.split(".");
    if (hintSegments.length !== segments.length) {
      continue;
    }
    let match = true;
    for (let index = 0; index < segments.length; index += 1) {
      if (hintSegments[index] !== "*" && hintSegments[index] !== segments[index]) {
        match = false;
        break;
      }
    }
    if (match) {
      return hint;
    }
  }
  return undefined;
}

function isSensitivePath(path: string, hints?: ConfigUiHints): boolean {
  if (hints) {
    const hint = matchHint(path, hints);
    if (hint?.sensitive !== undefined) {
      return Boolean(hint.sensitive);
    }
  }
  return isSensitiveConfigPath(path) || matchesExtraSensitivePath(path);
}

function sanitizePublicConfigValue<T>(value: T, prefix: string, hints?: ConfigUiHints): T {
  if (Array.isArray(value)) {
    const nextPath = prefix ? `${prefix}[]` : "[]";
    return value.map((entry) => sanitizePublicConfigValue(entry, nextPath, hints)) as T;
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const output: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    const nextPath = prefix ? `${prefix}.${key}` : key;
    if (isSensitivePath(nextPath, hints)) {
      continue;
    }
    output[key] = sanitizePublicConfigValue(val, nextPath, hints);
  }
  return output as T;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge(base: unknown, patch: unknown): unknown {
  if (!isObject(base) || !isObject(patch)) {
    return patch;
  }
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const previous = result[key];
    result[key] = deepMerge(previous, value);
  }
  return result;
}

function getPathValue(source: unknown, path: string): unknown {
  if (!source || typeof source !== "object") {
    return undefined;
  }
  const segments = path.split(".");
  let current: unknown = source;
  for (const segment of segments) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function setPathValue(target: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split(".");
  if (segments.length === 0) {
    return;
  }
  let current: Record<string, unknown> = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const next = current[segment];
    if (!isObject(next)) {
      current[segment] = {};
    }
    current = current[segment] as Record<string, unknown>;
  }
  current[segments[segments.length - 1]] = value;
}

function isMissingRequiredValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim().length === 0;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return false;
}

function resolveRuntimeConfig(config: Config, draftConfig?: Record<string, unknown>): Config {
  if (!draftConfig || Object.keys(draftConfig).length === 0) {
    return config;
  }
  const merged = deepMerge(config, draftConfig);
  return ConfigSchema.parse(merged);
}

function getActionById(config: Config, actionId: string): ConfigActionManifest | null {
  const actions = buildConfigSchemaView(config).actions;
  return actions.find((item) => item.id === actionId) ?? null;
}

function messageOrDefault(
  action: ConfigActionManifest,
  kind: "success" | "failure",
  fallback: string
): string {
  const text = kind === "success" ? action.success?.message : action.failure?.message;
  return text?.trim() ? text : fallback;
}

async function runFeishuVerifyAction(params: {
  config: Config;
  action: ConfigActionManifest;
}): Promise<ConfigActionExecuteResult> {
  const appId = String(params.config.channels.feishu.appId ?? "").trim();
  const appSecret = String(params.config.channels.feishu.appSecret ?? "").trim();
  if (!appId || !appSecret) {
    return {
      ok: false,
      status: "failed",
      message: messageOrDefault(params.action, "failure", "Verification failed: missing credentials"),
      data: {
        error: "missing credentials (appId, appSecret)"
      },
      nextActions: []
    };
  }

  const result = await probeFeishu(appId, appSecret);
  if (!result.ok) {
    return {
      ok: false,
      status: "failed",
      message: `${messageOrDefault(params.action, "failure", "Verification failed")}: ${result.error}`,
      data: {
        error: result.error,
        appId: result.appId ?? appId
      },
      nextActions: []
    };
  }

  const responseData: Record<string, unknown> = {
    appId: result.appId,
    botName: result.botName ?? null,
    botOpenId: result.botOpenId ?? null
  };

  const patch: Record<string, unknown> = {};
  for (const [targetPath, sourcePath] of Object.entries(params.action.resultMap ?? {})) {
    const mappedValue = sourcePath.startsWith("response.data.")
      ? responseData[sourcePath.slice("response.data.".length)]
      : undefined;
    if (mappedValue !== undefined) {
      setPathValue(patch, targetPath, mappedValue);
    }
  }

  return {
    ok: true,
    status: "success",
    message: messageOrDefault(
      params.action,
      "success",
      "Verified. Please finish Feishu event subscription and app publishing before using."
    ),
    data: responseData,
    patch: Object.keys(patch).length > 0 ? patch : undefined,
    nextActions: []
  };
}

const ACTION_HANDLERS: Record<string, ActionHandler> = {
  "channels.feishu.verifyConnection": runFeishuVerifyAction
};

function buildUiHints(config: Config): ConfigUiHints {
  return buildConfigSchemaView(config).uiHints;
}

function maskApiKey(value: string): { apiKeySet: boolean; apiKeyMasked?: string } {
  if (!value) {
    return { apiKeySet: false };
  }
  if (value.length < MASK_MIN_LENGTH) {
    return { apiKeySet: true, apiKeyMasked: "****" };
  }
  return {
    apiKeySet: true,
    apiKeyMasked: `${value.slice(0, 2)}****${value.slice(-4)}`
  };
}

function toProviderView(
  provider: ProviderConfig,
  providerName: string,
  uiHints: ConfigUiHints,
  spec?: ProviderSpec
): ProviderConfigView {
  const masked = maskApiKey(provider.apiKey);
  const extraHeaders =
    provider.extraHeaders && Object.keys(provider.extraHeaders).length > 0
      ? (sanitizePublicConfigValue(
          provider.extraHeaders,
          `providers.${providerName}.extraHeaders`,
          uiHints
        ) as Record<string, string>)
      : null;
  const view: ProviderConfigView = {
    apiKeySet: masked.apiKeySet,
    apiKeyMasked: masked.apiKeyMasked,
    apiBase: provider.apiBase ?? null,
    extraHeaders: extraHeaders && Object.keys(extraHeaders).length > 0 ? extraHeaders : null
  };
  if (spec?.supportsWireApi) {
    view.wireApi = provider.wireApi ?? spec.defaultWireApi ?? "auto";
  }
  return view;
}

export function buildConfigView(config: Config): ConfigView {
  const uiHints = buildUiHints(config);
  const providers: Record<string, ProviderConfigView> = {};
  for (const [name, provider] of Object.entries(config.providers)) {
    const spec = findProviderByName(name);
    providers[name] = toProviderView(provider as ProviderConfig, name, uiHints, spec);
  }
  return {
    agents: config.agents,
    providers,
    channels: sanitizePublicConfigValue(
      config.channels as Record<string, Record<string, unknown>>,
      "channels",
      uiHints
    ),
    bindings: sanitizePublicConfigValue(config.bindings, "bindings", uiHints),
    session: sanitizePublicConfigValue(config.session, "session", uiHints),
    tools: sanitizePublicConfigValue(config.tools, "tools", uiHints),
    gateway: sanitizePublicConfigValue(config.gateway, "gateway", uiHints),
    ui: sanitizePublicConfigValue(config.ui, "ui", uiHints)
  };
}

export function buildConfigMeta(config: Config): ConfigMetaView {
  const providers = PROVIDERS.map((spec) => ({
    name: spec.name,
    displayName: spec.displayName,
    keywords: spec.keywords,
    envKey: spec.envKey,
    isGateway: spec.isGateway,
    isLocal: spec.isLocal,
    defaultApiBase: spec.defaultApiBase,
    supportsWireApi: spec.supportsWireApi,
    wireApiOptions: spec.wireApiOptions,
    defaultWireApi: spec.defaultWireApi
  }));
  const channels = Object.keys(config.channels).map((name) => ({
    name,
    displayName: name,
    enabled: Boolean((config.channels as Record<string, { enabled?: boolean }>)[name]?.enabled)
  }));
  return { providers, channels };
}

export function buildConfigSchemaView(_config: Config): ConfigSchemaResponse {
  return buildConfigSchema({ version: getPackageVersion() });
}

export async function executeConfigAction(
  configPath: string,
  actionId: string,
  request: ConfigActionExecuteRequest
): Promise<ExecuteActionResult> {
  const baseConfig = loadConfigOrDefault(configPath);
  const action = getActionById(baseConfig, actionId);
  if (!action) {
    return {
      ok: false,
      code: "ACTION_NOT_FOUND",
      message: `unknown action: ${actionId}`
    };
  }

  if (request.scope && request.scope !== action.scope) {
    return {
      ok: false,
      code: "ACTION_SCOPE_MISMATCH",
      message: `scope mismatch: expected ${action.scope}, got ${request.scope}`,
      details: {
        expectedScope: action.scope,
        requestScope: request.scope
      }
    };
  }

  const runtimeConfig = resolveRuntimeConfig(baseConfig, request.draftConfig);

  for (const requiredPath of action.requires ?? []) {
    const requiredValue = getPathValue(runtimeConfig, requiredPath);
    if (isMissingRequiredValue(requiredValue)) {
      return {
        ok: false,
        code: "ACTION_PRECONDITION_FAILED",
        message: `required field missing: ${requiredPath}`,
        details: {
          path: requiredPath
        }
      };
    }
  }

  const handler = ACTION_HANDLERS[action.id];
  if (!handler) {
    return {
      ok: false,
      code: "ACTION_EXECUTION_FAILED",
      message: `action handler not found for type ${action.type}`
    };
  }

  const result = await handler({
    config: runtimeConfig,
    action
  });

  return {
    ok: true,
    data: result
  };
}

export function loadConfigOrDefault(configPath: string): Config {
  return loadConfig(configPath);
}

export function updateModel(
  configPath: string,
  patch: {
    model?: string;
    maxTokens?: number;
  }
): ConfigView {
  const config = loadConfigOrDefault(configPath);

  if (typeof patch.model === "string") {
    config.agents.defaults.model = patch.model;
  }
  if (typeof patch.maxTokens === "number" && Number.isFinite(patch.maxTokens)) {
    config.agents.defaults.maxTokens = Math.max(1, Math.trunc(patch.maxTokens));
  }

  const next = ConfigSchema.parse(config);
  saveConfig(next, configPath);
  return buildConfigView(next);
}

export function updateProvider(
  configPath: string,
  providerName: string,
  patch: ProviderConfigUpdate
): ProviderConfigView | null {
  const config = loadConfigOrDefault(configPath);
  const provider = (config.providers as Record<string, ProviderConfig>)[providerName];
  if (!provider) {
    return null;
  }
  const spec = findProviderByName(providerName);
  if (Object.prototype.hasOwnProperty.call(patch, "apiKey")) {
    provider.apiKey = patch.apiKey ?? "";
  }
  if (Object.prototype.hasOwnProperty.call(patch, "apiBase")) {
    provider.apiBase = patch.apiBase ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "extraHeaders")) {
    provider.extraHeaders = patch.extraHeaders ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "wireApi") && spec?.supportsWireApi) {
    provider.wireApi = patch.wireApi ?? spec.defaultWireApi ?? "auto";
  }
  const next = ConfigSchema.parse(config);
  saveConfig(next, configPath);
  const uiHints = buildUiHints(next);
  const updated = (next.providers as Record<string, ProviderConfig>)[providerName];
  return toProviderView(updated, providerName, uiHints, spec ?? undefined);
}

export function updateChannel(
  configPath: string,
  channelName: string,
  patch: Record<string, unknown>
): Record<string, unknown> | null {
  const config = loadConfigOrDefault(configPath);
  const channel = (config.channels as Record<string, Record<string, unknown>>)[channelName];
  if (!channel) {
    return null;
  }
  (config.channels as Record<string, Record<string, unknown>>)[channelName] = { ...channel, ...patch };
  const next = ConfigSchema.parse(config);
  saveConfig(next, configPath);
  const uiHints = buildUiHints(next);
  return sanitizePublicConfigValue(
    (next.channels as Record<string, Record<string, unknown>>)[channelName],
    `channels.${channelName}`,
    uiHints
  );
}

function normalizeSessionKey(value: string): string {
  return value.trim();
}

function createSessionManager(config: Config): SessionManager {
  return new SessionManager(getWorkspacePathFromConfig(config));
}

export function listSessions(
  configPath: string,
  query?: { q?: string; limit?: number; activeMinutes?: number }
): SessionsListView {
  const config = loadConfigOrDefault(configPath);
  const sessionManager = createSessionManager(config);
  const now = Date.now();
  const activeMinutes = typeof query?.activeMinutes === "number" ? Math.max(0, Math.trunc(query.activeMinutes)) : 0;
  const q = (query?.q ?? "").trim().toLowerCase();
  const limit = typeof query?.limit === "number" ? Math.max(0, Math.trunc(query.limit)) : 0;

  const entries = sessionManager
    .listSessions()
    .map((item) => {
      const key = typeof item.key === "string" ? normalizeSessionKey(item.key) : "";
      if (!key) {
        return null;
      }
      const session = sessionManager.getIfExists(key);
      const messages = session?.messages ?? [];
      const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
      const metadata = item.metadata && typeof item.metadata === "object" ? (item.metadata as Record<string, unknown>) : {};
      const label = typeof metadata.label === "string" ? metadata.label.trim() : "";
      const preferredModel =
        typeof metadata.preferred_model === "string" ? metadata.preferred_model.trim() : "";
      const createdAt = typeof item.created_at === "string" ? item.created_at : new Date(0).toISOString();
      const updatedAt = typeof item.updated_at === "string" ? item.updated_at : createdAt;
      return {
        key,
        createdAt,
        updatedAt,
        label: label || undefined,
        preferredModel: preferredModel || undefined,
        messageCount: messages.length,
        lastRole: typeof lastMessage?.role === "string" ? lastMessage.role : undefined,
        lastTimestamp: typeof lastMessage?.timestamp === "string" ? lastMessage.timestamp : undefined
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const filtered = entries.filter((entry) => {
    if (activeMinutes > 0) {
      const ageMs = now - new Date(entry.updatedAt).getTime();
      if (!Number.isFinite(ageMs) || ageMs > activeMinutes * 60_000) {
        return false;
      }
    }
    if (!q) {
      return true;
    }
    return entry.key.toLowerCase().includes(q) || (entry.label ?? "").toLowerCase().includes(q);
  });

  filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const total = filtered.length;
  const sessions = limit > 0 ? filtered.slice(0, limit) : filtered;
  return { sessions, total };
}

export function getSessionHistory(configPath: string, key: string, limit?: number): SessionHistoryView | null {
  const normalizedKey = normalizeSessionKey(key);
  if (!normalizedKey) {
    return null;
  }
  const config = loadConfigOrDefault(configPath);
  const sessionManager = createSessionManager(config);
  const session = sessionManager.getIfExists(normalizedKey);
  if (!session) {
    return null;
  }

  const safeLimit = typeof limit === "number" ? Math.min(500, Math.max(1, Math.trunc(limit))) : 200;
  const allMessages = session.messages;
  const messages = allMessages.length > safeLimit ? allMessages.slice(-safeLimit) : allMessages;
  return {
    key: normalizedKey,
    totalMessages: allMessages.length,
    metadata: session.metadata,
    messages: messages.map((message) => {
      const entry: Record<string, unknown> = {
        role: message.role,
        content: message.content,
        timestamp: message.timestamp
      };
      if (typeof message.name === "string") {
        entry.name = message.name;
      }
      if (typeof message.tool_call_id === "string") {
        entry.tool_call_id = message.tool_call_id;
      }
      return entry as SessionHistoryView["messages"][number];
    })
  };
}

export function patchSession(configPath: string, key: string, patch: SessionPatchUpdate): SessionHistoryView | null {
  const normalizedKey = normalizeSessionKey(key);
  if (!normalizedKey) {
    return null;
  }
  const config = loadConfigOrDefault(configPath);
  const sessionManager = createSessionManager(config);
  const session = sessionManager.getIfExists(normalizedKey);
  if (!session) {
    return null;
  }

  if (patch.clearHistory) {
    sessionManager.clear(session);
  }

  if (Object.prototype.hasOwnProperty.call(patch, "label")) {
    const label = typeof patch.label === "string" ? patch.label.trim() : "";
    if (label) {
      session.metadata.label = label;
    } else {
      delete session.metadata.label;
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, "preferredModel")) {
    const preferredModel = typeof patch.preferredModel === "string" ? patch.preferredModel.trim() : "";
    if (preferredModel) {
      session.metadata.preferred_model = preferredModel;
    } else {
      delete session.metadata.preferred_model;
    }
  }

  session.updatedAt = new Date();
  sessionManager.save(session);
  return getSessionHistory(configPath, normalizedKey, 200);
}

export function deleteSession(configPath: string, key: string): boolean {
  const normalizedKey = normalizeSessionKey(key);
  if (!normalizedKey) {
    return false;
  }
  const config = loadConfigOrDefault(configPath);
  const sessionManager = createSessionManager(config);
  return sessionManager.delete(normalizedKey);
}

export function updateRuntime(
  configPath: string,
  patch: RuntimeConfigUpdate
): Pick<ConfigView, "agents" | "bindings" | "session"> {
  const config = loadConfigOrDefault(configPath);

  if (patch.agents?.defaults && Object.prototype.hasOwnProperty.call(patch.agents.defaults, "contextTokens")) {
    const nextContextTokens = patch.agents.defaults.contextTokens;
    if (typeof nextContextTokens === "number" && Number.isFinite(nextContextTokens)) {
      config.agents.defaults.contextTokens = Math.max(1000, Math.trunc(nextContextTokens));
    }
  }

  if (patch.agents && Object.prototype.hasOwnProperty.call(patch.agents, "list")) {
    config.agents.list = (patch.agents.list ?? []).map((entry) => ({
      ...entry,
      default: Boolean(entry.default)
    }));
  }

  if (Object.prototype.hasOwnProperty.call(patch, "bindings")) {
    config.bindings = patch.bindings ?? [];
  }

  if (patch.session) {
    const nextAgentToAgent = {
      ...config.session.agentToAgent,
      ...(patch.session.agentToAgent ?? {})
    };

    config.session = {
      ...config.session,
      ...patch.session,
      agentToAgent: nextAgentToAgent
    };
  }

  const next = ConfigSchema.parse(config);
  saveConfig(next, configPath);
  const view = buildConfigView(next);

  return {
    agents: view.agents,
    bindings: view.bindings ?? [],
    session: view.session ?? {}
  };
}
