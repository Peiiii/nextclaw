import type {
  NcpAgentRunInput,
  NcpAgentRunOptions,
  NcpAgentRuntime,
  NcpEndpointEvent,
} from "@nextclaw/ncp";
import type { RuntimeFactoryParams } from "@nextclaw/ncp-toolkit";
import {
  CodexSdkNcpAgentRuntime,
  type CodexSdkNcpAgentRuntimeConfig,
} from "@nextclaw/nextclaw-ncp-runtime-codex-sdk";
import {
  buildUserFacingModelRoute,
  buildCodexBridgeModelProviderId,
  resolveExternalModelProvider,
} from "./codex-model-provider.js";
import {
  CODEX_APPROVAL_POLICY,
  mapAccessModeToSandboxMode,
  resolveCodexAccessMode,
} from "./codex-access-mode.js";
import { buildCodexInputBuilder } from "./codex-input-builder.js";
import { ensureCodexOpenAiResponsesBridge } from "./codex-openai-responses-bridge.js";
import { resolveCodexResponsesApiSupport } from "./codex-responses-capability.js";
import {
  createDescribeCodexSessionType,
  type SessionTypeDescriptor,
} from "./codex-session-type.js";
import type {
  AgentRuntimeApi,
  CodexReasoningEffort,
  PluginApi,
  PluginDefinition,
  ResolvedProviderRuntime,
  ResolvedProviderSpec,
} from "./codex-runtime-plugin-types.js";

const PLUGIN_ID = "nextclaw-ncp-runtime-plugin-codex-sdk";
const CODEX_RUNTIME_KIND = "codex";

class DeferredCodexSdkNcpAgentRuntime implements NcpAgentRuntime {
  private runtimePromise: Promise<NcpAgentRuntime> | null = null;

  constructor(private readonly createRuntime: () => Promise<NcpAgentRuntime>) {}

  run(
    input: NcpAgentRunInput,
    options?: NcpAgentRunOptions,
  ): AsyncIterable<NcpEndpointEvent> {
    const resolveRuntime = async () => {
      if (!this.runtimePromise) {
        this.runtimePromise = this.createRuntime();
      }
      return await this.runtimePromise;
    };

    const stream = async function* (
      this: DeferredCodexSdkNcpAgentRuntime,
    ): AsyncGenerator<NcpEndpointEvent> {
      const runtime = await resolveRuntime();
      yield* runtime.run(input, options);
    }.bind(this);

    return stream();
  }
}

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

function readThinkingLevel(value: unknown): CodexReasoningEffort | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "minimal" ||
    normalized === "low" ||
    normalized === "medium" ||
    normalized === "high" ||
    normalized === "xhigh"
  ) {
    return normalized;
  }
  return undefined;
}

function resolveCodexExecutionOptions(params: {
  runtimeAgent: AgentRuntimeApi;
  pluginConfig: Record<string, unknown>;
}): {
  workingDirectory: string;
  skipGitRepoCheck: boolean;
} {
  const configuredWorkingDirectory = readString(params.pluginConfig.workingDirectory);
  const workspace = params.runtimeAgent.resolveWorkspacePath(
    configuredWorkingDirectory ?? params.runtimeAgent.defaults.workspace,
  );

  return {
    workingDirectory: workspace,
    skipGitRepoCheck: readBoolean(params.pluginConfig.skipGitRepoCheck) ?? true,
  };
}

function resolveCodexCliConfig(
  params: {
    pluginConfig: Record<string, unknown>;
    providerName?: string | null;
    providerDisplayName?: string | null;
    apiBase?: string;
    modelProviderOverride?: string;
  },
): CodexSdkNcpAgentRuntimeConfig["cliConfig"] | undefined {
  const explicitConfig = readRecord(params.pluginConfig.config);
  const modelProvider =
    readString(params.modelProviderOverride) ??
    resolveExternalModelProvider({
      explicitModelProvider: params.pluginConfig.modelProvider,
      providerName: params.providerName,
      providerDisplayName: params.providerDisplayName,
      pluginId: PLUGIN_ID,
    });
  const preferredAuthMethod =
    readString(params.pluginConfig.preferredAuthMethod) ?? "apikey";
  const apiBase = readString(params.pluginConfig.apiBase) ?? readString(params.apiBase);
  const config: Record<string, unknown> = {
    model_provider: modelProvider,
    preferred_auth_method: preferredAuthMethod,
  };
  if (modelProvider && apiBase) {
    config.model_providers = {
      [modelProvider]: {
        name: modelProvider,
        base_url: apiBase,
        wire_api: "responses",
        requires_openai_auth: true,
      },
    };
  }

  return {
    ...config,
    ...(explicitConfig ?? {}),
  } as CodexSdkNcpAgentRuntimeConfig["cliConfig"];
}

function resolveCodexModel(params: {
  runtimeAgent: AgentRuntimeApi;
  pluginConfig: Record<string, unknown>;
  sessionMetadata: Record<string, unknown>;
}): string {
  return (
    readString(params.sessionMetadata.preferred_model) ??
    readString(params.sessionMetadata.model) ??
    readString(params.pluginConfig.model) ??
    params.runtimeAgent.defaults.model ??
    ""
  );
}

const plugin: PluginDefinition = {
  id: PLUGIN_ID,
  name: "NextClaw Codex NCP Runtime",
  description: "Registers NCP session type `codex` backed by OpenAI Codex SDK.",
  configSchema: {
    type: "object",
    additionalProperties: true,
    properties: {},
  },
  register(api) {
    const pluginConfig = readRecord(api.pluginConfig) ?? {};
    const describeCodexSessionType = createDescribeCodexSessionType({
      defaultModel: readString(api.runtime.agent.defaults.model),
      pluginConfig,
    });

    api.registerNcpAgentRuntime({
      kind: CODEX_RUNTIME_KIND,
      label: "Codex",
      describeSessionType: describeCodexSessionType,
      createRuntime: (runtimeParams) => {
        return new DeferredCodexSdkNcpAgentRuntime(async () => {
          const model = resolveCodexModel({
            runtimeAgent: api.runtime.agent,
            pluginConfig,
            sessionMetadata: runtimeParams.sessionMetadata,
          });
          const resolvedProviderRuntime = api.runtime.agent.resolveProviderRuntime(model);
          const providerName = resolvedProviderRuntime.providerName;
          const capabilitySpec = resolvedProviderRuntime.providerSpec ?? null;
          const providerDisplayName = resolvedProviderRuntime.providerDisplayName;
          const externalModelProvider = resolveExternalModelProvider({
            explicitModelProvider: pluginConfig.modelProvider,
            providerName,
            providerDisplayName,
            pluginId: PLUGIN_ID,
          });
          const userFacingModelRoute = buildUserFacingModelRoute({
            externalModelProvider,
            providerLocalModel: resolvedProviderRuntime.providerLocalModel,
            resolvedModel: resolvedProviderRuntime.resolvedModel,
          });
          const upstreamApiBase =
            readString(pluginConfig.apiBase) ??
            resolvedProviderRuntime.apiBase ??
            undefined;
          const apiKey =
            readString(pluginConfig.apiKey) ?? resolvedProviderRuntime.apiKey ?? undefined;
          if (!apiKey) {
            throw new Error(
              `[codex] missing apiKey. Set plugins.entries.${PLUGIN_ID}.config.apiKey or providers.*.apiKey for model "${userFacingModelRoute}".`,
            );
          }
          if (!upstreamApiBase) {
            throw new Error(
              `[codex] missing apiBase for model "${userFacingModelRoute}". Configure plugins.entries.${PLUGIN_ID}.config.apiBase or providers.*.apiBase.`,
            );
          }

          let codexApiBase = upstreamApiBase;
          let codexModelProviderOverride: string | undefined;
          const supportsResponsesApi = await resolveCodexResponsesApiSupport({
            capabilitySpec,
            wireApi: readString(resolvedProviderRuntime.provider?.wireApi),
            apiBase: upstreamApiBase,
            apiKey,
            extraHeaders: resolvedProviderRuntime.provider?.extraHeaders ?? null,
            model: resolvedProviderRuntime.providerLocalModel,
          });
          if (!supportsResponsesApi) {
            const bridge = await ensureCodexOpenAiResponsesBridge({
              upstreamApiBase,
              upstreamApiKey: apiKey,
              upstreamExtraHeaders: resolvedProviderRuntime.provider?.extraHeaders ?? undefined,
              defaultModel: resolvedProviderRuntime.providerLocalModel,
              modelPrefixes: [
                providerName ?? "",
                externalModelProvider,
                resolvedProviderRuntime.providerDisplayName ?? "",
              ],
            });
            codexApiBase = bridge.baseUrl;
            codexModelProviderOverride = buildCodexBridgeModelProviderId(
              externalModelProvider,
            );
          }

          const executionOptions = resolveCodexExecutionOptions({
            runtimeAgent: api.runtime.agent,
            pluginConfig,
          });
          const accessMode = resolveCodexAccessMode(pluginConfig);
          const thinkingLevel =
            readThinkingLevel(runtimeParams.sessionMetadata.preferred_thinking) ??
            readThinkingLevel(runtimeParams.sessionMetadata.thinking) ??
            undefined;

          return new CodexSdkNcpAgentRuntime({
            sessionId: runtimeParams.sessionId,
            apiKey,
            apiBase: codexApiBase,
            model: resolvedProviderRuntime.providerLocalModel,
            threadId: readString(runtimeParams.sessionMetadata.codex_thread_id) ?? null,
            codexPathOverride: readString(pluginConfig.codexPathOverride),
            env: readStringRecord(pluginConfig.env),
            cliConfig: resolveCodexCliConfig({
              pluginConfig,
              providerName,
              providerDisplayName,
              apiBase: codexApiBase,
              modelProviderOverride: codexModelProviderOverride,
            }),
            stateManager: runtimeParams.stateManager,
            sessionMetadata: runtimeParams.sessionMetadata,
            setSessionMetadata: runtimeParams.setSessionMetadata,
            inputBuilder: buildCodexInputBuilder(
              api.runtime.agent,
              executionOptions.workingDirectory,
            ),
            threadOptions: {
              model,
              sandboxMode: mapAccessModeToSandboxMode(accessMode),
              workingDirectory: executionOptions.workingDirectory,
              skipGitRepoCheck: executionOptions.skipGitRepoCheck,
              modelReasoningEffort: thinkingLevel,
              networkAccessEnabled: readBoolean(pluginConfig.networkAccessEnabled),
              webSearchMode:
                readString(pluginConfig.webSearchMode) as
                  | "disabled"
                  | "cached"
                  | "live"
                  | undefined,
              webSearchEnabled: readBoolean(pluginConfig.webSearchEnabled),
              approvalPolicy: CODEX_APPROVAL_POLICY,
              additionalDirectories: readStringArray(pluginConfig.additionalDirectories),
            },
          });
        });
      },
    });
  },
};

export default plugin;
