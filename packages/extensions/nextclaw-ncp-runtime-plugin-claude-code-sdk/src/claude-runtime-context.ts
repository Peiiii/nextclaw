import {
  getApiBase,
  buildRequestedSkillsUserPrompt,
  getProvider,
  getWorkspacePath,
  SkillsLoader,
  type Config,
} from "@nextclaw/core";
import type { NcpAgentRunInput } from "@nextclaw/ncp";
import { resolveClaudeProviderRouting } from "./claude-provider-routing.js";
import {
  dedupeStrings,
  normalizeClaudeModel,
  readBoolean,
  readNumber,
  readRecord,
  readString,
  readStringArray,
  readStringOrNullRecord,
  readStringRecord,
} from "./claude-runtime-shared.js";

type ClaudePermissionMode = "default" | "acceptEdits" | "bypassPermissions" | "plan" | "dontAsk";
type ClaudeSettingSource = "user" | "project" | "local";
type ClaudeExecutable = "node" | "bun" | "deno";

function readRequestedSkills(metadata: Record<string, unknown>): string[] {
  const raw = metadata.requested_skills ?? metadata.requestedSkills;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((entry) => readString(entry))
    .filter((entry): entry is string => Boolean(entry))
    .slice(0, 8);
}

function readPermissionMode(value: unknown): ClaudePermissionMode | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  if (
    value === "default" ||
    value === "acceptEdits" ||
    value === "bypassPermissions" ||
    value === "plan" ||
    value === "dontAsk"
  ) {
    return value;
  }
  return undefined;
}

function readSettingSources(value: unknown): ClaudeSettingSource[] | undefined {
  const list = readStringArray(value);
  if (!list) {
    return undefined;
  }

  const out: ClaudeSettingSource[] = [];
  for (const entry of list) {
    if (entry === "user" || entry === "project" || entry === "local") {
      out.push(entry);
    }
  }
  return out.length > 0 ? out : undefined;
}

function readExecutable(value: unknown): ClaudeExecutable | undefined {
  if (value === "node" || value === "bun" || value === "deno") {
    return value;
  }
  return undefined;
}

function readUserText(input: NcpAgentRunInput): string {
  for (let index = input.messages.length - 1; index >= 0; index -= 1) {
    const message = input.messages[index];
    if (message?.role !== "user") {
      continue;
    }
    const text = message.parts
      .filter((part): part is Extract<typeof message.parts[number], { type: "text" }> => part.type === "text")
      .map((part) => part.text)
      .join("")
      .trim();
    if (text) {
      return text;
    }
  }
  return "";
}

export function buildClaudeInputBuilder(workspace: string) {
  const skillsLoader = new SkillsLoader(workspace);
  return async (input: NcpAgentRunInput): Promise<string> => {
    const userText = readUserText(input);
    const metadata =
      input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
        ? (input.metadata as Record<string, unknown>)
        : {};
    const requestedSkills = readRequestedSkills(metadata);
    return buildRequestedSkillsUserPrompt(skillsLoader, requestedSkills, userText);
  };
}

function resolveClaudeModel(params: {
  config: Config;
  pluginConfig: Record<string, unknown>;
  sessionMetadata: Record<string, unknown>;
}): string {
  return (
    readString(params.sessionMetadata.preferred_model) ??
    readString(params.sessionMetadata.model) ??
    readString(params.pluginConfig.model) ??
    params.config.agents.defaults.model
  );
}

function resolveBaseQueryOptions(params: {
  config: Config;
  pluginConfig: Record<string, unknown>;
}): Record<string, unknown> {
  const explicitConfig = readRecord(params.pluginConfig.config);
  const maxTurns =
    readNumber(params.pluginConfig.maxTurns) ?? Math.max(1, Math.trunc(params.config.agents.defaults.maxToolIterations));
  const baseOptions: Record<string, unknown> = {
    permissionMode: readPermissionMode(params.pluginConfig.permissionMode) ?? "bypassPermissions",
    includePartialMessages: readBoolean(params.pluginConfig.includePartialMessages) ?? true,
    maxTurns,
    additionalDirectories: readStringArray(params.pluginConfig.additionalDirectories),
    allowedTools: readStringArray(params.pluginConfig.allowedTools),
    disallowedTools: readStringArray(params.pluginConfig.disallowedTools),
    settingSources: readSettingSources(params.pluginConfig.settingSources),
    pathToClaudeCodeExecutable:
      readString(params.pluginConfig.pathToClaudeCodeExecutable) ?? readString(params.pluginConfig.claudeCodePath),
    executable: readExecutable(params.pluginConfig.executable),
    executableArgs: readStringArray(params.pluginConfig.executableArgs),
    extraArgs: readStringOrNullRecord(params.pluginConfig.extraArgs),
    sandbox: readRecord(params.pluginConfig.sandbox),
    persistSession: readBoolean(params.pluginConfig.persistSession),
    continue: readBoolean(params.pluginConfig.continue),
  };

  const maxThinkingTokens = readNumber(params.pluginConfig.maxThinkingTokens);
  if (typeof maxThinkingTokens === "number") {
    baseOptions.maxThinkingTokens = maxThinkingTokens;
  }

  const allowDangerouslySkipPermissions = readBoolean(params.pluginConfig.allowDangerouslySkipPermissions);
  if (typeof allowDangerouslySkipPermissions === "boolean") {
    baseOptions.allowDangerouslySkipPermissions = allowDangerouslySkipPermissions;
  }

  return {
    ...baseOptions,
    ...(explicitConfig ?? {}),
  };
}

function readBaseQuerySettingSources(baseQueryOptions: Record<string, unknown>): ClaudeSettingSource[] {
  return readSettingSources(baseQueryOptions.settingSources) ?? [];
}

function hasClaudeAuthEnv(env: Record<string, string> | undefined): boolean {
  if (!env) {
    return false;
  }
  return Boolean(
    readString(env.ANTHROPIC_API_KEY) ??
      readString(env.ANTHROPIC_AUTH_TOKEN) ??
      readString(env.CLAUDE_CODE_OAUTH_TOKEN),
  );
}

function hasClaudeBaseUrlEnv(env: Record<string, string> | undefined): boolean {
  if (!env) {
    return false;
  }
  return Boolean(
    readString(env.ANTHROPIC_BASE_URL) ??
      readString(env.ANTHROPIC_API_URL) ??
      readString(env.CLAUDE_CODE_API_BASE_URL),
  );
}

function resolveClaudeWorkingDirectory(params: {
  config: Config;
  pluginConfig: Record<string, unknown>;
}): string {
  return getWorkspacePath(
    readString(params.pluginConfig.workingDirectory) ?? params.config.agents.defaults.workspace,
  );
}

function resolveConfiguredClaudeModels(params: {
  config: Config;
  pluginConfig: Record<string, unknown>;
  modelInput: string;
}): string[] {
  const configuredProviders =
    params.config.providers && typeof params.config.providers === "object" && !Array.isArray(params.config.providers)
      ? (params.config.providers as Record<string, { models?: string[] | null }>)
      : {};
  const configuredModels = Object.entries(configuredProviders).flatMap(([providerName, provider]) =>
    (provider.models ?? [])
      .map((modelName) => readString(modelName))
      .filter((modelName): modelName is string => Boolean(modelName))
      .map((modelName) => `${providerName}/${modelName}`),
  );

  const fallbackModels = configuredModels.length > 0 ? configuredModels : [params.modelInput];
  return dedupeStrings(fallbackModels);
}

export function intersectSdkModelsWithConfiguredModels(params: {
  configuredModels: string[];
  sdkModels?: string[];
}): string[] | undefined {
  if (!params.sdkModels || params.sdkModels.length === 0) {
    return params.configuredModels.length > 0 ? params.configuredModels : undefined;
  }

  const rawSdkModelSet = new Set(params.sdkModels.map((model) => normalizeClaudeModel(model)));
  const matchedConfiguredModels = params.configuredModels.filter((model) =>
    rawSdkModelSet.has(normalizeClaudeModel(model)),
  );

  if (matchedConfiguredModels.length > 0) {
    return dedupeStrings(matchedConfiguredModels);
  }
  return params.configuredModels.length > 0 ? params.configuredModels : undefined;
}

export function resolveRecommendedClaudeModel(params: {
  configuredModels: string[];
  modelInput: string;
  pluginConfig: Record<string, unknown>;
}): string | null {
  const configuredModel = readString(params.pluginConfig.model) ?? params.modelInput;
  if (params.configuredModels.includes(configuredModel)) {
    return configuredModel;
  }
  return params.configuredModels[0] ?? configuredModel ?? null;
}

export function resolveClaudeRuntimeContext(params: {
  config: Config;
  pluginConfig: Record<string, unknown>;
  sessionMetadata: Record<string, unknown>;
}) {
  const requestedModelInput = resolveClaudeModel(params);
  const hasExplicitSessionModel = Boolean(
    readString(params.sessionMetadata.preferred_model) ?? readString(params.sessionMetadata.model),
  );
  const providerRouting = resolveClaudeProviderRouting({
    config: params.config,
    pluginConfig: params.pluginConfig,
    modelInput: requestedModelInput,
    allowRecommendedFallback: !hasExplicitSessionModel,
  });
  const modelInput = providerRouting.modelInput;
  const provider = getProvider(params.config, modelInput);
  const env = readStringRecord(params.pluginConfig.env);
  const workingDirectory = resolveClaudeWorkingDirectory({
    config: params.config,
    pluginConfig: params.pluginConfig,
  });
  const baseQueryOptions = resolveBaseQueryOptions({
    config: params.config,
    pluginConfig: params.pluginConfig,
  });
  const explicitPluginApiKey = readString(params.pluginConfig.apiKey);
  const explicitPluginAuthToken = readString(params.pluginConfig.authToken);
  const explicitPluginApiBase = readString(params.pluginConfig.apiBase);
  const useProviderCredentials = readBoolean(params.pluginConfig.useProviderCredentials) === true;
  const providerApiKey = provider?.apiKey?.trim() || undefined;
  const providerApiBase = getApiBase(params.config, modelInput) ?? undefined;
  const settingSources = readBaseQuerySettingSources(baseQueryOptions);
  const shouldUseProviderRoute = providerRouting.route !== null;
  const shouldUseExplicitFallback =
    !shouldUseProviderRoute &&
    (Boolean(explicitPluginApiKey) ||
      Boolean(explicitPluginAuthToken) ||
      Boolean(explicitPluginApiBase) ||
      (useProviderCredentials && Boolean(providerApiKey)));
  const prefersClaudeManagedConnection =
    !shouldUseProviderRoute &&
    !shouldUseExplicitFallback &&
    !explicitPluginApiKey &&
    !explicitPluginAuthToken &&
    !explicitPluginApiBase &&
    !hasClaudeAuthEnv(env) &&
    !hasClaudeBaseUrlEnv(env) &&
    settingSources.length > 0;
  const apiKey = shouldUseProviderRoute
    ? providerRouting.route?.apiKey
    : prefersClaudeManagedConnection
      ? undefined
      : explicitPluginApiKey ?? (useProviderCredentials ? providerApiKey : undefined);
  const authToken = shouldUseProviderRoute
    ? providerRouting.route?.authToken
    : prefersClaudeManagedConnection
      ? undefined
      : explicitPluginAuthToken ?? (useProviderCredentials ? providerApiKey : undefined);
  const apiBase = shouldUseProviderRoute
    ? providerRouting.route?.apiBase
    : prefersClaudeManagedConnection
      ? undefined
      : explicitPluginApiBase ?? (useProviderCredentials ? providerApiBase : undefined);
  const usesExternalAuth =
    env?.CLAUDE_CODE_USE_BEDROCK === "1" ||
    env?.CLAUDE_CODE_USE_VERTEX === "1" ||
    env?.CLAUDE_CODE_USE_FOUNDRY === "1";
  const allowsClaudeManagedAuth =
    prefersClaudeManagedConnection || hasClaudeAuthEnv(env) || hasClaudeBaseUrlEnv(env) || settingSources.length > 0;
  const configuredModels =
    providerRouting.configuredModels.length > 0
      ? providerRouting.configuredModels
      : resolveConfiguredClaudeModels({
          config: params.config,
          pluginConfig: params.pluginConfig,
          modelInput,
        });

  return {
    modelInput,
    apiKey,
    authToken,
    apiBase,
    env,
    usesExternalAuth,
    allowsClaudeManagedAuth,
    workingDirectory,
    baseQueryOptions,
    configuredModels,
    routeKind: providerRouting.route?.kind ?? null,
    reason: providerRouting.reason,
    reasonMessage: providerRouting.reasonMessage,
    recommendedModel:
      resolveRecommendedClaudeModel({
        configuredModels,
        modelInput,
        pluginConfig: params.pluginConfig,
      }) ?? providerRouting.recommendedModel,
  };
}
