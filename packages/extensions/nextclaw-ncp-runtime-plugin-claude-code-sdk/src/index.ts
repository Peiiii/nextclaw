import {
  getApiBase,
  buildRequestedSkillsUserPrompt,
  getProvider,
  SkillsLoader,
  type Config,
} from "@nextclaw/core";
import type { NcpAgentRunInput, NcpAgentRuntime } from "@nextclaw/ncp";
import type { RuntimeFactoryParams } from "@nextclaw/ncp-toolkit";
import {
  ClaudeCodeSdkNcpAgentRuntime,
  type ClaudeCodeSdkNcpAgentRuntimeConfig,
} from "@nextclaw/nextclaw-ncp-runtime-claude-code-sdk";

const PLUGIN_ID = "nextclaw-ncp-runtime-plugin-claude-code-sdk";
const CLAUDE_RUNTIME_KIND = "claude";

type ClaudePermissionMode = "default" | "acceptEdits" | "bypassPermissions" | "plan" | "dontAsk";
type ClaudeSettingSource = "user" | "project" | "local";
type ClaudeExecutable = "node" | "bun" | "deno";

type PluginApi = {
  config: Config;
  pluginConfig?: Record<string, unknown>;
  registerNcpAgentRuntime: (registration: {
    kind: string;
    label?: string;
    createRuntime: (params: RuntimeFactoryParams) => NcpAgentRuntime;
  }) => void;
};

type PluginDefinition = {
  id: string;
  name: string;
  description: string;
  configSchema: Record<string, unknown>;
  register: (api: PluginApi) => void;
};

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const values = value
    .map((entry) => readString(entry))
    .filter((entry): entry is string => Boolean(entry));
  return values.length > 0 ? values : undefined;
}

function readStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const out: Record<string, string> = {};
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (typeof entryValue !== "string") {
      continue;
    }
    const normalized = entryValue.trim();
    if (!normalized) {
      continue;
    }
    out[entryKey] = normalized;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function readStringOrNullRecord(value: unknown): Record<string, string | null> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const out: Record<string, string | null> = {};
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (typeof entryValue === "string") {
      out[entryKey] = entryValue.trim();
      continue;
    }
    if (entryValue === null) {
      out[entryKey] = null;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

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

function normalizeClaudeModel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.includes("/")) {
    return trimmed;
  }
  const parts = trimmed.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? trimmed;
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

function buildClaudeInputBuilder(workspace: string) {
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

const plugin: PluginDefinition = {
  id: PLUGIN_ID,
  name: "NextClaw Claude NCP Runtime",
  description: "Registers NCP session type `claude` backed by Anthropic Claude Agent SDK.",
  configSchema: {
    type: "object",
    additionalProperties: true,
    properties: {},
  },
  register(api) {
    const pluginConfig = readRecord(api.pluginConfig) ?? {};

    api.registerNcpAgentRuntime({
      kind: CLAUDE_RUNTIME_KIND,
      label: "Claude",
      createRuntime: (runtimeParams) => {
        const nextConfig = api.config;
        const modelInput = resolveClaudeModel({
          config: nextConfig,
          pluginConfig,
          sessionMetadata: runtimeParams.sessionMetadata,
        });
        const provider = getProvider(nextConfig, modelInput);
        const apiKey = readString(pluginConfig.apiKey) ?? provider?.apiKey ?? undefined;
        const apiBase = readString(pluginConfig.apiBase) ?? getApiBase(nextConfig, modelInput) ?? undefined;
        const env = readStringRecord(pluginConfig.env);
        const usesExternalAuth =
          env?.CLAUDE_CODE_USE_BEDROCK === "1" || env?.CLAUDE_CODE_USE_VERTEX === "1";

        if (!apiKey && !usesExternalAuth) {
          throw new Error(
            `[claude] missing apiKey. Set plugins.entries.${PLUGIN_ID}.config.apiKey or providers.*.apiKey for model "${modelInput}", or enable CLAUDE_CODE_USE_BEDROCK / CLAUDE_CODE_USE_VERTEX in plugin env.`,
          );
        }

        const workingDirectory =
          readString(pluginConfig.workingDirectory) ?? nextConfig.agents.defaults.workspace;

        const runtimeConfig: ClaudeCodeSdkNcpAgentRuntimeConfig = {
          sessionId: runtimeParams.sessionId,
          apiKey: apiKey ?? "",
          apiBase,
          model: normalizeClaudeModel(modelInput),
          workingDirectory,
          sessionRuntimeId: readString(runtimeParams.sessionMetadata.claude_session_id) ?? null,
          env,
          baseQueryOptions: resolveBaseQueryOptions({
            config: nextConfig,
            pluginConfig,
          }),
          requestTimeoutMs: Math.max(0, Math.trunc(readNumber(pluginConfig.requestTimeoutMs) ?? 30000)),
          sessionMetadata: runtimeParams.sessionMetadata,
          setSessionMetadata: runtimeParams.setSessionMetadata,
          inputBuilder: buildClaudeInputBuilder(workingDirectory),
          stateManager: runtimeParams.stateManager,
        };

        return new ClaudeCodeSdkNcpAgentRuntime(runtimeConfig);
      },
    });
  },
};

export default plugin;
