import type { Config } from "@nextclaw/core";
import type { NcpAgentRuntime } from "@nextclaw/ncp";
import type { RuntimeFactoryParams } from "@nextclaw/ncp-toolkit";
import {
  ClaudeCodeSdkNcpAgentRuntime,
  type ClaudeCodeSdkNcpAgentRuntimeConfig,
  loadAndProbeClaudeCodeSdkCapability,
} from "@nextclaw/nextclaw-ncp-runtime-claude-code-sdk";
import {
  buildClaudeInputBuilder,
  intersectSdkModelsWithConfiguredModels,
  resolveClaudeRuntimeContext,
  resolveRecommendedClaudeModel,
} from "./claude-runtime-context.js";
import {
  normalizeClaudeModel,
  readBoolean,
  readNumber,
  readRecord,
  readString,
} from "./claude-runtime-shared.js";

const PLUGIN_ID = "nextclaw-ncp-runtime-plugin-claude-code-sdk";
const CLAUDE_RUNTIME_KIND = "claude";

type SessionTypeDescriptor = {
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
};

type PluginApi = {
  config: Config;
  pluginConfig?: Record<string, unknown>;
  registerNcpAgentRuntime: (registration: {
    kind: string;
    label?: string;
    createRuntime: (params: RuntimeFactoryParams) => NcpAgentRuntime;
    describeSessionType?: () => Promise<SessionTypeDescriptor | null | undefined>;
  }) => void;
};

type PluginDefinition = {
  id: string;
  name: string;
  description: string;
  configSchema: Record<string, unknown>;
  register: (api: PluginApi) => void;
};

function createDescribeClaudeSessionType(params: {
  config: Config;
  pluginConfig: Record<string, unknown>;
}): () => Promise<SessionTypeDescriptor> {
  const shouldProbeCapability = readBoolean(params.pluginConfig.capabilityProbe) ?? true;
  const capabilityCacheTtlMs = Math.max(
    0,
    Math.trunc(readNumber(params.pluginConfig.capabilityCacheTtlMs) ?? 30000),
  );
  let capabilityCache:
    | {
        expiresAt: number;
        value: SessionTypeDescriptor;
      }
    | null = null;
  let capabilityProbePromise: Promise<SessionTypeDescriptor> | null = null;

  return async () => {
    if (capabilityCache && capabilityCache.expiresAt > Date.now()) {
      return capabilityCache.value;
    }
    if (capabilityProbePromise) {
      return await capabilityProbePromise;
    }

    capabilityProbePromise = (async () => {
      const runtimeContext = resolveClaudeRuntimeContext({
        config: params.config,
        pluginConfig: params.pluginConfig,
        sessionMetadata: {},
      });

      if (
        !runtimeContext.apiKey &&
        !runtimeContext.authToken &&
        !runtimeContext.usesExternalAuth &&
        !runtimeContext.allowsClaudeManagedAuth
      ) {
        return {
          ready: false,
          reason: runtimeContext.reason ?? "api_key_missing",
          reasonMessage:
            runtimeContext.reasonMessage ??
            "Configure Claude auth, Claude user settings, or an explicit Anthropic-compatible gateway credential before starting a Claude session.",
          supportedModels: runtimeContext.configuredModels,
          recommendedModel: runtimeContext.recommendedModel,
          cta: {
            kind: "providers",
            label: "Configure Providers",
          },
        };
      }

      if (!shouldProbeCapability) {
        return {
          ready: true,
          reason: null,
          reasonMessage: null,
          supportedModels: runtimeContext.configuredModels,
          recommendedModel: runtimeContext.recommendedModel,
          cta: null,
        };
      }

      const capability = await loadAndProbeClaudeCodeSdkCapability({
        apiKey: runtimeContext.apiKey ?? "",
        authToken: runtimeContext.authToken,
        apiBase: runtimeContext.apiBase,
        env: runtimeContext.env,
        workingDirectory: runtimeContext.workingDirectory,
        model: normalizeClaudeModel(runtimeContext.modelInput),
        baseQueryOptions: runtimeContext.baseQueryOptions,
        configuredModels: runtimeContext.configuredModels,
        recommendedModel: normalizeClaudeModel(runtimeContext.recommendedModel ?? runtimeContext.modelInput),
        probeTimeoutMs: Math.max(1000, Math.trunc(readNumber(params.pluginConfig.probeTimeoutMs) ?? 5000)),
        executionProbeTimeoutMs: Math.max(
          1000,
          Math.trunc(readNumber(params.pluginConfig.executionProbeTimeoutMs) ?? 8000),
        ),
        verifyExecution: readBoolean(params.pluginConfig.verifyExecution) ?? true,
        allowMissingApiKey:
          runtimeContext.usesExternalAuth ||
          runtimeContext.allowsClaudeManagedAuth ||
          Boolean(runtimeContext.authToken),
      });

      const supportedModels = intersectSdkModelsWithConfiguredModels({
        configuredModels: runtimeContext.configuredModels,
        sdkModels: capability.supportedModels,
      });
      const recommendedModel =
        resolveRecommendedClaudeModel({
          configuredModels: supportedModels ?? runtimeContext.configuredModels,
          modelInput: runtimeContext.modelInput,
          pluginConfig: params.pluginConfig,
        }) ?? runtimeContext.recommendedModel;

      return {
        ready: capability.ready,
        reason: capability.reason ?? null,
        reasonMessage: capability.reasonMessage ?? null,
        supportedModels,
        recommendedModel,
        cta: capability.ready
          ? null
          : {
              kind: "providers",
              label: "Fix Claude Setup",
            },
      };
    })();

    try {
      const value = await capabilityProbePromise;
      capabilityCache = {
        expiresAt: Date.now() + capabilityCacheTtlMs,
        value,
      };
      return value;
    } finally {
      capabilityProbePromise = null;
    }
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
    const describeClaudeSessionType = createDescribeClaudeSessionType({
      config: api.config,
      pluginConfig,
    });

    api.registerNcpAgentRuntime({
      kind: CLAUDE_RUNTIME_KIND,
      label: "Claude",
      describeSessionType: describeClaudeSessionType,
      createRuntime: (runtimeParams) => {
        const runtimeContext = resolveClaudeRuntimeContext({
          config: api.config,
          pluginConfig,
          sessionMetadata: runtimeParams.sessionMetadata,
        });

        if (
          !runtimeContext.apiKey &&
          !runtimeContext.authToken &&
          !runtimeContext.usesExternalAuth &&
          !runtimeContext.allowsClaudeManagedAuth
        ) {
          throw new Error(
            `[claude] ${runtimeContext.reasonMessage ?? `missing auth. Configure Claude user settings, plugins.entries.${PLUGIN_ID}.config.authToken/apiKey, switch to a Claude-compatible provider/model, enable providers-based credentials with useProviderCredentials=true, or enable CLAUDE_CODE_USE_BEDROCK / CLAUDE_CODE_USE_VERTEX / CLAUDE_CODE_USE_FOUNDRY in plugin env.`}`,
          );
        }

        const runtimeConfig: ClaudeCodeSdkNcpAgentRuntimeConfig = {
          sessionId: runtimeParams.sessionId,
          apiKey: runtimeContext.apiKey ?? "",
          authToken: runtimeContext.authToken,
          apiBase: runtimeContext.apiBase,
          model: normalizeClaudeModel(runtimeContext.modelInput),
          workingDirectory: runtimeContext.workingDirectory,
          sessionRuntimeId: readString(runtimeParams.sessionMetadata.claude_session_id) ?? null,
          env: runtimeContext.env,
          baseQueryOptions: runtimeContext.baseQueryOptions,
          requestTimeoutMs: Math.max(0, Math.trunc(readNumber(pluginConfig.requestTimeoutMs) ?? 30000)),
          sessionMetadata: runtimeParams.sessionMetadata,
          setSessionMetadata: runtimeParams.setSessionMetadata,
          inputBuilder: buildClaudeInputBuilder(runtimeContext.workingDirectory),
          stateManager: runtimeParams.stateManager,
        };

        return new ClaudeCodeSdkNcpAgentRuntime(runtimeConfig);
      },
    });
  },
};

export default plugin;
