import type { Config } from "@nextclaw/core";
import { loadAndProbeClaudeCodeSdkCapability } from "@nextclaw/nextclaw-ncp-runtime-claude-code-sdk";
import { listClaudeProviderRouteCandidates } from "./claude-provider-routing.utils.js";
import type { resolveClaudeRuntimeContext } from "./claude-runtime-context.utils.js";
import {
  dedupeStrings,
  normalizeClaudeModel,
  readBoolean,
  readNumber,
  readString,
  resolveClaudeExecutionProbeTimeoutMs,
} from "./claude-runtime-shared.utils.js";

const HARD_CLAUDE_SETUP_FAILURE_REASONS = new Set([
  "api_key_missing",
  "authentication_failed",
  "claude_executable_missing",
]);

export type ClaudeRouteProbeSummary = {
  supportedModels: string[];
  hardFailureReason: string | null;
  hardFailureMessage: string | null;
};

export function buildClaudeGatewayConfig(params: {
  routeKind: string | null;
  apiBase?: string;
  apiKey?: string;
  authToken?: string;
}) {
  const { apiBase, apiKey, authToken, routeKind } = params;
  if (routeKind !== "anthropic-gateway") {
    return undefined;
  }
  const upstreamApiBase = readString(apiBase);
  if (!upstreamApiBase) {
    return undefined;
  }
  return {
    upstreamApiBase,
    upstreamApiKey: readString(authToken) ?? readString(apiKey),
  };
}

export function isHardClaudeSetupFailure(reason: string | null | undefined): boolean {
  return HARD_CLAUDE_SETUP_FAILURE_REASONS.has(reason ?? "");
}

export async function probeClaudeRouteModels(params: {
  config: Config;
  runtimeContext: ReturnType<typeof resolveClaudeRuntimeContext>;
  pluginConfig: Record<string, unknown>;
}): Promise<ClaudeRouteProbeSummary> {
  const { config, pluginConfig, runtimeContext } = params;
  const routeCandidates = listClaudeProviderRouteCandidates({
    config,
    pluginConfig,
  });
  const probeTimeoutMs = Math.max(1000, Math.trunc(readNumber(pluginConfig.probeTimeoutMs) ?? 5000));
  const executionProbeTimeoutMs = resolveClaudeExecutionProbeTimeoutMs(
    pluginConfig.executionProbeTimeoutMs,
  );
  const verifyExecution = readBoolean(pluginConfig.verifyExecution) ?? true;

  if (routeCandidates.length === 0) {
    return {
      supportedModels: [],
      hardFailureReason: null,
      hardFailureMessage: null,
    };
  }

  const results = await Promise.all(
    routeCandidates.map(async (route) => {
      const seedModel = route.configuredModels[0];
      if (!seedModel) {
        return {
          capability: null,
          supportedModels: [] as string[],
        };
      }

      const routeCapabilityBase = {
        apiKey: route.apiKey ?? "",
        authToken: route.authToken,
        apiBase: route.apiBase,
        anthropicGateway: buildClaudeGatewayConfig({
          routeKind: route.kind,
          apiBase: route.apiBase,
          apiKey: route.apiKey,
          authToken: route.authToken,
        }),
        env: runtimeContext.env,
        workingDirectory: runtimeContext.workingDirectory,
        baseQueryOptions: runtimeContext.baseQueryOptions,
        probeTimeoutMs,
        executionProbeTimeoutMs,
        verifyExecution,
        allowMissingApiKey: Boolean(route.authToken),
      };

      const capability = await loadAndProbeClaudeCodeSdkCapability({
        ...routeCapabilityBase,
        model: normalizeClaudeModel(seedModel),
        configuredModels: route.configuredModels,
        recommendedModel: normalizeClaudeModel(seedModel),
      });

      if (!capability.ready) {
        return {
          capability,
          supportedModels: [] as string[],
        };
      }

      const modelProbeResults = await Promise.all(
        route.configuredModels.map(async (model) => {
          const modelCapability = await loadAndProbeClaudeCodeSdkCapability({
            ...routeCapabilityBase,
            model: normalizeClaudeModel(model),
            configuredModels: [model],
            recommendedModel: normalizeClaudeModel(model),
          });
          return modelCapability.ready ? model : null;
        }),
      );

      return {
        capability,
        supportedModels: modelProbeResults.filter((model): model is string => Boolean(model)),
      };
    }),
  );

  const supportedModels = dedupeStrings(results.flatMap((entry) => entry.supportedModels));
  const hardFailure = results.find((entry) => isHardClaudeSetupFailure(entry.capability?.reason));

  return {
    supportedModels,
    hardFailureReason: hardFailure?.capability?.reason ?? null,
    hardFailureMessage: hardFailure?.capability?.reasonMessage ?? null,
  };
}
