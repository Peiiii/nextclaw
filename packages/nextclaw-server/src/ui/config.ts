import {
  loadConfig,
  saveConfig,
  ConfigSchema,
  probeFeishu,
  LiteLLMProvider,
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
  getProviderName,
  getPackageVersion,
  hasSecretRef,
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
  ProviderConnectionTestRequest,
  ProviderConnectionTestResult,
  ProviderConfigView,
  SecretsConfigUpdate,
  SecretsView,
  SessionsListView,
  SessionHistoryView,
  SessionPatchUpdate
} from "./types.js";

const MASK_MIN_LENGTH = 8;
const EXTRA_SENSITIVE_PATH_PATTERNS = [/authorization/i, /cookie/i, /session/i, /bearer/i];
const PREFERRED_PROVIDER_ORDER = [
  "nextclaw",
  "openai",
  "anthropic",
  "gemini",
  "openrouter",
  "dashscope",
  "deepseek",
  "minimax",
  "moonshot",
  "zhipu"
] as const;

const PREFERRED_PROVIDER_ORDER_INDEX: Map<string, number> = new Map(
  PREFERRED_PROVIDER_ORDER.map((name, index) => [name, index])
);
const BUILTIN_PROVIDER_NAMES = new Set(PROVIDERS.map((spec) => spec.name));
const CUSTOM_PROVIDER_WIRE_API_OPTIONS: Array<"auto" | "chat" | "responses"> = ["auto", "chat", "responses"];
const CUSTOM_PROVIDER_PREFIX = "custom-";
const PROVIDER_TEST_MAX_TOKENS = 16;

function normalizeOptionalDisplayName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isCustomProviderName(name: string): boolean {
  return name.trim().length > 0 && !BUILTIN_PROVIDER_NAMES.has(name);
}

function resolveCustomProviderFallbackDisplayName(name: string): string {
  if (name.startsWith(CUSTOM_PROVIDER_PREFIX)) {
    const suffix = name.slice(CUSTOM_PROVIDER_PREFIX.length);
    if (/^\d+$/.test(suffix)) {
      return `Custom ${suffix}`;
    }
  }
  return name;
}

function resolveProviderDisplayName(
  providerName: string,
  provider: ProviderConfig | undefined,
  spec?: ProviderSpec
): string | undefined {
  const configDisplayName = normalizeOptionalDisplayName(provider?.displayName);
  if (isCustomProviderName(providerName)) {
    return configDisplayName ?? resolveCustomProviderFallbackDisplayName(providerName);
  }
  return spec?.displayName ?? configDisplayName ?? spec?.name;
}

function listCustomProviderNames(config: Config): string[] {
  return Object.keys(config.providers).filter((name) => isCustomProviderName(name));
}

function findNextCustomProviderName(config: Config): string {
  const providers = config.providers as Record<string, ProviderConfig>;
  let index = 1;
  while (providers[`${CUSTOM_PROVIDER_PREFIX}${index}`]) {
    index += 1;
  }
  return `${CUSTOM_PROVIDER_PREFIX}${index}`;
}

function clearSecretRefsByPrefix(config: Config, pathPrefix: string): void {
  for (const key of Object.keys(config.secrets.refs)) {
    if (key === pathPrefix || key.startsWith(`${pathPrefix}.`)) {
      delete config.secrets.refs[key];
    }
  }
}

type ChannelTutorialUrls = NonNullable<ConfigMetaView["channels"][number]["tutorialUrls"]>;

const DOCS_BASE_URL = "https://docs.nextclaw.io";
const CHANNEL_TUTORIAL_URLS: Record<string, ChannelTutorialUrls> = {
  feishu: {
    default: `${DOCS_BASE_URL}/guide/tutorials/feishu`,
    en: `${DOCS_BASE_URL}/en/guide/tutorials/feishu`,
    zh: `${DOCS_BASE_URL}/zh/guide/tutorials/feishu`
  }
};

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

function normalizeModelList(input: string[] | null | undefined): string[] {
  if (!input || input.length === 0) {
    return [];
  }
  const deduped = new Set<string>();
  for (const item of input) {
    if (typeof item !== "string") {
      continue;
    }
    const trimmed = item.trim();
    if (!trimmed) {
      continue;
    }
    deduped.add(trimmed);
  }
  return [...deduped];
}

function toProviderView(
  config: Config,
  provider: ProviderConfig,
  providerName: string,
  uiHints: ConfigUiHints,
  spec?: ProviderSpec
): ProviderConfigView {
  const apiKeyPath = `providers.${providerName}.apiKey`;
  const apiKeyRefSet = hasSecretRef(config, apiKeyPath);
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
    displayName: resolveProviderDisplayName(providerName, provider, spec),
    apiKeySet: masked.apiKeySet || apiKeyRefSet,
    apiKeyMasked: masked.apiKeyMasked ?? (apiKeyRefSet ? "****" : undefined),
    apiBase: provider.apiBase ?? null,
    extraHeaders: extraHeaders && Object.keys(extraHeaders).length > 0 ? extraHeaders : null,
    models: normalizeModelList(provider.models ?? [])
  };
  const supportsWireApi = Boolean(spec?.supportsWireApi) || isCustomProviderName(providerName);
  if (supportsWireApi) {
    view.wireApi = provider.wireApi ?? spec?.defaultWireApi ?? "auto";
  }
  return view;
}

export function buildConfigView(config: Config): ConfigView {
  const uiHints = buildUiHints(config);
  const providers: Record<string, ProviderConfigView> = {};
  for (const [name, provider] of Object.entries(config.providers)) {
    const spec = findProviderByName(name);
    providers[name] = toProviderView(config, provider as ProviderConfig, name, uiHints, spec);
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
    ui: sanitizePublicConfigValue(config.ui, "ui", uiHints),
    secrets: {
      enabled: config.secrets.enabled,
      defaults: { ...config.secrets.defaults },
      providers: { ...config.secrets.providers },
      refs: { ...config.secrets.refs }
    } satisfies SecretsView
  };
}

function clearSecretRef(config: Config, path: string): void {
  if (config.secrets.refs[path]) {
    delete config.secrets.refs[path];
  }
}

export function buildConfigMeta(config: Config): ConfigMetaView {
  const configProviders = config.providers as Record<string, ProviderConfig>;
  const builtinProviders = PROVIDERS.map((spec) => {
    const providerConfig = configProviders[spec.name];
    return {
      name: spec.name,
      displayName: resolveProviderDisplayName(spec.name, providerConfig, spec),
      isCustom: false,
      modelPrefix: spec.modelPrefix,
      keywords: spec.keywords,
      envKey: spec.envKey,
      isGateway: spec.isGateway,
      isLocal: spec.isLocal,
      defaultApiBase: spec.defaultApiBase,
      logo: spec.logo,
      apiBaseHelp: spec.apiBaseHelp,
      defaultModels: normalizeModelList(spec.defaultModels ?? []),
      supportsWireApi: spec.supportsWireApi,
      wireApiOptions: spec.wireApiOptions,
      defaultWireApi: spec.defaultWireApi
    };
  }).sort((left, right) => {
    const leftRank = PREFERRED_PROVIDER_ORDER_INDEX.get(left.name);
    const rightRank = PREFERRED_PROVIDER_ORDER_INDEX.get(right.name);
    if (leftRank !== undefined && rightRank !== undefined) {
      return leftRank - rightRank;
    }
    if (leftRank !== undefined) {
      return -1;
    }
    if (rightRank !== undefined) {
      return 1;
    }
    return left.name.localeCompare(right.name);
  });

  const customProviders = listCustomProviderNames(config)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }))
    .map((name) => {
      const providerConfig = configProviders[name];
      const displayName = resolveProviderDisplayName(name, providerConfig);
      return {
        name,
        displayName,
        isCustom: true,
        modelPrefix: name,
        keywords: normalizeModelList([name, displayName ?? ""]),
        envKey: "OPENAI_API_KEY",
        isGateway: false,
        isLocal: false,
        defaultApiBase: undefined,
        logo: undefined,
        apiBaseHelp: undefined,
        defaultModels: [],
        supportsWireApi: true,
        wireApiOptions: CUSTOM_PROVIDER_WIRE_API_OPTIONS,
        defaultWireApi: "auto" as const
      };
    });
  const providers = [...customProviders, ...builtinProviders];
  const channels = Object.keys(config.channels).map((name) => {
    const tutorialUrls = CHANNEL_TUTORIAL_URLS[name];
    const tutorialUrl = tutorialUrls?.default ?? tutorialUrls?.en ?? tutorialUrls?.zh;
    return {
      name,
      displayName: name,
      enabled: Boolean((config.channels as Record<string, { enabled?: boolean }>)[name]?.enabled),
      tutorialUrl,
      tutorialUrls
    };
  });
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
  }
): ConfigView {
  const config = loadConfigOrDefault(configPath);

  if (typeof patch.model === "string") {
    config.agents.defaults.model = patch.model;
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
  const isCustom = isCustomProviderName(providerName);
  if (Object.prototype.hasOwnProperty.call(patch, "displayName") && isCustom) {
    provider.displayName = normalizeOptionalDisplayName(patch.displayName) ?? "";
  }
  if (Object.prototype.hasOwnProperty.call(patch, "apiKey")) {
    provider.apiKey = patch.apiKey ?? "";
    clearSecretRef(config, `providers.${providerName}.apiKey`);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "apiBase")) {
    provider.apiBase = patch.apiBase ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "extraHeaders")) {
    provider.extraHeaders = patch.extraHeaders ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "wireApi") && (spec?.supportsWireApi || isCustom)) {
    provider.wireApi = patch.wireApi ?? spec?.defaultWireApi ?? "auto";
  }
  if (Object.prototype.hasOwnProperty.call(patch, "models")) {
    provider.models = normalizeModelList(patch.models ?? []);
  }
  const next = ConfigSchema.parse(config);
  saveConfig(next, configPath);
  const uiHints = buildUiHints(next);
  const updated = (next.providers as Record<string, ProviderConfig>)[providerName];
  return toProviderView(next, updated, providerName, uiHints, spec ?? undefined);
}

export function createCustomProvider(
  configPath: string,
  patch: ProviderConfigUpdate = {}
): { name: string; provider: ProviderConfigView } {
  const config = loadConfigOrDefault(configPath);
  const providerName = findNextCustomProviderName(config);
  const providers = config.providers as Record<string, ProviderConfig>;
  const generatedDisplayName = resolveCustomProviderFallbackDisplayName(providerName);
  providers[providerName] = {
    displayName: normalizeOptionalDisplayName(patch.displayName) ?? generatedDisplayName,
    apiKey: normalizeOptionalString(patch.apiKey) ?? "",
    apiBase: normalizeOptionalString(patch.apiBase),
    extraHeaders: normalizeHeaders(patch.extraHeaders ?? null),
    wireApi: patch.wireApi ?? "auto",
    models: normalizeModelList(patch.models ?? [])
  };
  const next = ConfigSchema.parse(config);
  saveConfig(next, configPath);
  const uiHints = buildUiHints(next);
  const created = (next.providers as Record<string, ProviderConfig>)[providerName];
  return {
    name: providerName,
    provider: toProviderView(next, created, providerName, uiHints)
  };
}

export function deleteCustomProvider(configPath: string, providerName: string): boolean | null {
  if (!isCustomProviderName(providerName)) {
    return null;
  }
  const config = loadConfigOrDefault(configPath);
  const providers = config.providers as Record<string, ProviderConfig>;
  if (!providers[providerName]) {
    return null;
  }
  delete providers[providerName];
  clearSecretRefsByPrefix(config, `providers.${providerName}`);
  const next = ConfigSchema.parse(config);
  saveConfig(next, configPath);
  return true;
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeHeaders(input: Record<string, string> | null | undefined): Record<string, string> | null {
  if (!input) {
    return null;
  }
  const entries = Object.entries(input)
    .map(([key, value]) => [key.trim(), String(value ?? "").trim()] as const)
    .filter(([key, value]) => key.length > 0 && value.length > 0);
  if (entries.length === 0) {
    return null;
  }
  return Object.fromEntries(entries);
}

function buildScopedProviderModel(
  providerName: string,
  model: string,
  spec?: ProviderSpec
): string {
  const trimmed = model.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.includes("/")) {
    return trimmed;
  }
  if (isCustomProviderName(providerName)) {
    return trimmed;
  }
  const prefix = (spec?.modelPrefix ?? providerName).trim();
  if (!prefix) {
    return trimmed;
  }
  return `${prefix}/${trimmed}`;
}

function resolveTestModel(
  config: Config,
  providerName: string,
  requestedModel: string | null,
  provider: ProviderConfig,
  spec?: ProviderSpec
): string | null {
  if (requestedModel) {
    if (isCustomProviderName(providerName)) {
      const prefix = `${providerName}/`;
      if (requestedModel.startsWith(prefix)) {
        return requestedModel.slice(prefix.length) || null;
      }
    }
    return requestedModel;
  }

  const providerModels = normalizeModelList(provider.models ?? [])
    .map((modelId) => buildScopedProviderModel(providerName, modelId, spec))
    .filter((modelId) => modelId.length > 0);
  if (providerModels.length > 0) {
    return providerModels[0];
  }

  const defaultModel = normalizeOptionalString(config.agents.defaults.model);
  if (defaultModel) {
    const routedProvider = getProviderName(config, defaultModel);
    if (!routedProvider || routedProvider === providerName) {
      return defaultModel;
    }
  }

  if (isCustomProviderName(providerName)) {
    return null;
  }
  const specDefaultModel = normalizeModelList(spec?.defaultModels ?? [])[0] ?? null;
  return specDefaultModel ?? defaultModel ?? null;
}

function stringifyError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.replace(/\s+/g, " ").trim();
}

export async function testProviderConnection(
  configPath: string,
  providerName: string,
  patch: ProviderConnectionTestRequest
): Promise<ProviderConnectionTestResult | null> {
  const config = loadConfigOrDefault(configPath);
  const provider = (config.providers as Record<string, ProviderConfig>)[providerName];
  if (!provider) {
    return null;
  }

  const spec = findProviderByName(providerName);
  const hasApiKeyPatch = Object.prototype.hasOwnProperty.call(patch, "apiKey");
  const providedApiKey = normalizeOptionalString(patch.apiKey);
  const currentApiKey = normalizeOptionalString(provider.apiKey);
  const apiKey = hasApiKeyPatch ? providedApiKey : currentApiKey;

  const hasApiBasePatch = Object.prototype.hasOwnProperty.call(patch, "apiBase");
  const patchedApiBase = normalizeOptionalString(patch.apiBase);
  const currentApiBase = normalizeOptionalString(provider.apiBase);
  const apiBase = hasApiBasePatch
    ? patchedApiBase ?? spec?.defaultApiBase ?? null
    : currentApiBase ?? spec?.defaultApiBase ?? null;

  const hasHeadersPatch = Object.prototype.hasOwnProperty.call(patch, "extraHeaders");
  const extraHeaders = hasHeadersPatch
    ? normalizeHeaders(patch.extraHeaders ?? null)
    : normalizeHeaders(provider.extraHeaders ?? null);

  const isCustom = isCustomProviderName(providerName);
  const wireApi = (spec?.supportsWireApi || isCustom)
    ? patch.wireApi ?? provider.wireApi ?? spec?.defaultWireApi ?? "auto"
    : null;

  if (!apiKey && !spec?.isLocal) {
    return {
      success: false,
      provider: providerName,
      latencyMs: 0,
      message: "API key is required before testing the connection."
    };
  }

  const requestedModel = normalizeOptionalString(patch.model);
  const model = resolveTestModel(config, providerName, requestedModel, provider, spec ?? undefined);
  if (!model) {
    return {
      success: false,
      provider: providerName,
      latencyMs: 0,
      message: "No test model found. Configure provider models or set a default model for this provider, then try again."
    };
  }

  const probe = new LiteLLMProvider({
    apiKey,
    apiBase,
    defaultModel: model,
    extraHeaders,
    providerName,
    wireApi
  });

  const startedAtMs = Date.now();
  try {
    await probe.chat({
      model,
      messages: [{ role: "user", content: "ping" }],
      maxTokens: PROVIDER_TEST_MAX_TOKENS
    });
    return {
      success: true,
      provider: providerName,
      model,
      latencyMs: Date.now() - startedAtMs,
      message: "Connection test passed."
    };
  } catch (error) {
    return {
      success: false,
      provider: providerName,
      model,
      latencyMs: Date.now() - startedAtMs,
      message: stringifyError(error) || "Connection test failed."
    };
  }
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
  for (const key of Object.keys(patch)) {
    const path = `channels.${channelName}.${key}`;
    if (isSensitivePath(path)) {
      clearSecretRef(config, path);
    }
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
  const safeEventLimit = Math.min(2000, Math.max(50, safeLimit * 4));
  const allEvents = session.events ?? [];
  const events = allEvents.length > safeEventLimit ? allEvents.slice(-safeEventLimit) : allEvents;
  return {
    key: normalizedKey,
    totalMessages: allMessages.length,
    totalEvents: allEvents.length,
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
      if (Array.isArray(message.tool_calls)) {
        entry.tool_calls = message.tool_calls;
      }
      if (typeof message.reasoning_content === "string") {
        entry.reasoning_content = message.reasoning_content;
      }
      return entry as SessionHistoryView["messages"][number];
    }),
    events: events.map((event) => {
      const entry: SessionHistoryView["events"][number] = {
        seq: event.seq,
        type: event.type,
        timestamp: event.timestamp
      };
      const message = event.data?.message;
      if (message && typeof message === "object" && !Array.isArray(message)) {
        const typed = message as Record<string, unknown>;
        if (typeof typed.role === "string" && typeof typed.timestamp === "string") {
          entry.message = {
            role: typed.role,
            content: typed.content,
            timestamp: typed.timestamp,
            ...(typeof typed.name === "string" ? { name: typed.name } : {}),
            ...(typeof typed.tool_call_id === "string" ? { tool_call_id: typed.tool_call_id } : {}),
            ...(Array.isArray(typed.tool_calls) ? { tool_calls: typed.tool_calls as Array<Record<string, unknown>> } : {}),
            ...(typeof typed.reasoning_content === "string" ? { reasoning_content: typed.reasoning_content } : {})
          };
        }
      }
      return entry;
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

  const defaultsPatch = patch.agents?.defaults;
  if (defaultsPatch && Object.prototype.hasOwnProperty.call(defaultsPatch, "contextTokens")) {
    const nextContextTokens = defaultsPatch.contextTokens;
    if (typeof nextContextTokens === "number" && Number.isFinite(nextContextTokens)) {
      config.agents.defaults.contextTokens = Math.max(1000, Math.trunc(nextContextTokens));
    }
  }
  if (defaultsPatch && Object.prototype.hasOwnProperty.call(defaultsPatch, "engine")) {
    config.agents.defaults.engine = normalizeOptionalString(defaultsPatch.engine) ?? "native";
  }
  if (defaultsPatch && Object.prototype.hasOwnProperty.call(defaultsPatch, "engineConfig")) {
    const nextEngineConfig = defaultsPatch.engineConfig;
    if (nextEngineConfig && typeof nextEngineConfig === "object" && !Array.isArray(nextEngineConfig)) {
      config.agents.defaults.engineConfig = { ...nextEngineConfig };
    }
  }

  if (patch.agents && Object.prototype.hasOwnProperty.call(patch.agents, "list")) {
    config.agents.list = (patch.agents.list ?? []).map((entry) => {
      const normalizedEngine = normalizeOptionalString(entry.engine);
      const hasEngineConfig =
        entry.engineConfig &&
        typeof entry.engineConfig === "object" &&
        !Array.isArray(entry.engineConfig);
      return {
        ...entry,
        default: Boolean(entry.default),
        ...(normalizedEngine ? { engine: normalizedEngine } : {}),
        ...(hasEngineConfig ? { engineConfig: { ...entry.engineConfig } } : {})
      };
    });
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

export function updateSecrets(
  configPath: string,
  patch: SecretsConfigUpdate
): SecretsView {
  const config = loadConfigOrDefault(configPath);

  if (Object.prototype.hasOwnProperty.call(patch, "enabled")) {
    config.secrets.enabled = Boolean(patch.enabled);
  }

  if (patch.defaults) {
    const nextDefaults = { ...config.secrets.defaults };
    for (const source of ["env", "file", "exec"] as const) {
      if (!Object.prototype.hasOwnProperty.call(patch.defaults, source)) {
        continue;
      }
      const value = patch.defaults[source];
      if (typeof value === "string" && value.trim()) {
        nextDefaults[source] = value.trim();
      } else {
        delete nextDefaults[source];
      }
    }
    config.secrets.defaults = nextDefaults;
  }

  if (Object.prototype.hasOwnProperty.call(patch, "providers")) {
    config.secrets.providers = (patch.providers ?? {}) as Config["secrets"]["providers"];
  }

  if (Object.prototype.hasOwnProperty.call(patch, "refs")) {
    config.secrets.refs = (patch.refs ?? {}) as Config["secrets"]["refs"];
  }

  const next = ConfigSchema.parse(config);
  saveConfig(next, configPath);
  return {
    enabled: next.secrets.enabled,
    defaults: { ...next.secrets.defaults },
    providers: { ...next.secrets.providers },
    refs: { ...next.secrets.refs }
  };
}
