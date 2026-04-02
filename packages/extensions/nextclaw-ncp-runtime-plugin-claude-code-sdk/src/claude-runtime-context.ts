import {
  getApiBase,
  RequestedSkillsMetadataReader,
  SessionProjectContextResolver,
  SkillsLoader,
  buildBootstrapAwareUserPrompt,
  getProvider,
  resolveSessionWorkspacePath,
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

function readMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export function buildClaudeInputBuilder(
  params: {
    workspace: string;
    hostWorkspace?: string;
    sessionMetadata?: Record<string, unknown>;
    contextConfig?: Config["agents"]["context"];
  },
) {
  const { contextConfig, hostWorkspace, sessionMetadata, workspace } = params;
  const requestedSkillsReader = new RequestedSkillsMetadataReader();
  const projectContextResolver = new SessionProjectContextResolver();

  return async (input: NcpAgentRunInput): Promise<string> => {
    const userText = readUserText(input);
    const metadata = {
      ...readMetadata(sessionMetadata),
      ...readMetadata(input.metadata),
    };
    const projectContext = projectContextResolver.resolve({
      sessionMetadata: metadata,
      workspace: hostWorkspace ?? workspace,
      defaultWorkspace: workspace,
    });
    const skillsLoader = new SkillsLoader({
      workspace: projectContext.hostWorkspace,
      projectRoot: projectContext.projectRoot,
    });

    return buildBootstrapAwareUserPrompt({
      workspace: projectContext.effectiveWorkspace,
      hostWorkspace: projectContext.hostWorkspace,
      contextConfig,
      sessionKey: input.sessionId,
      metadata,
      skills: skillsLoader,
      skillSelectors: requestedSkillsReader.readSelectors(metadata),
      userMessage: userText,
    });
  };
}

function resolveClaudeModel(params: {
  config: Config;
  pluginConfig: Record<string, unknown>;
  sessionMetadata: Record<string, unknown>;
}): string {
  const { config, pluginConfig, sessionMetadata } = params;
  return (
    readString(sessionMetadata.preferred_model) ??
    readString(sessionMetadata.model) ??
    readString(pluginConfig.model) ??
    config.agents.defaults.model
  );
}

function resolveBaseQueryOptions(params: {
  config: Config;
  pluginConfig: Record<string, unknown>;
}): Record<string, unknown> {
  const { config, pluginConfig } = params;
  const explicitConfig = readRecord(pluginConfig.config);
  const maxTurns = readNumber(pluginConfig.maxTurns) ?? Math.max(1, Math.trunc(config.agents.defaults.maxToolIterations));
  const baseOptions: Record<string, unknown> = {
    permissionMode: readPermissionMode(pluginConfig.permissionMode) ?? "bypassPermissions",
    includePartialMessages: readBoolean(pluginConfig.includePartialMessages) ?? true,
    maxTurns,
    additionalDirectories: readStringArray(pluginConfig.additionalDirectories),
    allowedTools: readStringArray(pluginConfig.allowedTools),
    disallowedTools: readStringArray(pluginConfig.disallowedTools),
    settingSources: readSettingSources(pluginConfig.settingSources),
    pathToClaudeCodeExecutable:
      readString(pluginConfig.pathToClaudeCodeExecutable) ?? readString(pluginConfig.claudeCodePath),
    executable: readExecutable(pluginConfig.executable),
    executableArgs: readStringArray(pluginConfig.executableArgs),
    extraArgs: readStringOrNullRecord(pluginConfig.extraArgs),
    sandbox: readRecord(pluginConfig.sandbox),
    persistSession: readBoolean(pluginConfig.persistSession),
    continue: readBoolean(pluginConfig.continue),
  };

  const maxThinkingTokens = readNumber(pluginConfig.maxThinkingTokens);
  if (typeof maxThinkingTokens === "number") {
    baseOptions.maxThinkingTokens = maxThinkingTokens;
  }

  const allowDangerouslySkipPermissions = readBoolean(pluginConfig.allowDangerouslySkipPermissions);
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
  sessionMetadata: Record<string, unknown>;
}): string {
  const { config, pluginConfig, sessionMetadata } = params;
  return resolveSessionWorkspacePath({
    sessionMetadata,
    workspace: readString(pluginConfig.workingDirectory) ?? config.agents.defaults.workspace,
  });
}

function resolveConfiguredClaudeModels(params: {
  config: Config;
  modelInput: string;
}): string[] {
  const { config, modelInput } = params;
  const configuredProviders =
    config.providers && typeof config.providers === "object" && !Array.isArray(config.providers)
      ? (config.providers as Record<string, { models?: string[] | null }>)
      : {};
  const configuredModels = Object.entries(configuredProviders).flatMap(([providerName, provider]) =>
    (provider.models ?? [])
      .map((modelName) => readString(modelName))
      .filter((modelName): modelName is string => Boolean(modelName))
      .map((modelName) => `${providerName}/${modelName}`),
  );

  const fallbackModels = configuredModels.length > 0 ? configuredModels : [modelInput];
  return dedupeStrings(fallbackModels);
}

export function intersectSdkModelsWithConfiguredModels(params: {
  configuredModels: string[];
  sdkModels?: string[];
}): string[] | undefined {
  const { configuredModels, sdkModels } = params;
  if (!sdkModels || sdkModels.length === 0) {
    return configuredModels.length > 0 ? configuredModels : undefined;
  }

  const rawSdkModelSet = new Set(sdkModels.map((model) => normalizeClaudeModel(model)));
  const matchedConfiguredModels = configuredModels.filter((model) => rawSdkModelSet.has(normalizeClaudeModel(model)));

  if (matchedConfiguredModels.length > 0) {
    return dedupeStrings(matchedConfiguredModels);
  }
  return configuredModels.length > 0 ? configuredModels : undefined;
}

export function resolveRecommendedClaudeModel(params: {
  configuredModels: string[];
  modelInput: string;
  pluginConfig: Record<string, unknown>;
}): string | null {
  const { configuredModels, modelInput, pluginConfig } = params;
  const configuredModel = readString(pluginConfig.model) ?? modelInput;
  if (configuredModels.includes(configuredModel)) {
    return configuredModel;
  }
  return configuredModels[0] ?? configuredModel ?? null;
}

export function resolveClaudeRuntimeContext(params: {
  config: Config;
  pluginConfig: Record<string, unknown>;
  sessionMetadata: Record<string, unknown>;
}) {
  const { config, pluginConfig, sessionMetadata } = params;
  const requestedModelInput = resolveClaudeModel(params);
  const hasExplicitSessionModel = Boolean(readString(sessionMetadata.preferred_model) ?? readString(sessionMetadata.model));
  const providerRouting = resolveClaudeProviderRouting({
    config,
    pluginConfig,
    modelInput: requestedModelInput,
    allowRecommendedFallback: !hasExplicitSessionModel,
  });
  const modelInput = providerRouting.modelInput;
  const provider = getProvider(config, modelInput);
  const env = readStringRecord(pluginConfig.env);
  const workingDirectory = resolveClaudeWorkingDirectory({
    config,
    pluginConfig,
    sessionMetadata,
  });
  const baseQueryOptions = resolveBaseQueryOptions({
    config,
    pluginConfig,
  });
  const explicitPluginApiKey = readString(pluginConfig.apiKey);
  const explicitPluginAuthToken = readString(pluginConfig.authToken);
  const explicitPluginApiBase = readString(pluginConfig.apiBase);
  const useProviderCredentials = readBoolean(pluginConfig.useProviderCredentials) === true;
  const providerApiKey = provider?.apiKey?.trim() || undefined;
  const providerApiBase = getApiBase(config, modelInput) ?? undefined;
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
          config,
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
        pluginConfig,
      }) ?? providerRouting.recommendedModel,
  };
}
