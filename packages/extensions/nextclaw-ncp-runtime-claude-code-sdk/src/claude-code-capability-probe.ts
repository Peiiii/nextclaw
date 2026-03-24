import { createRequire } from "node:module";
import type {
  ClaudeCodeQuery,
  ClaudeCodeLoader,
  ClaudeCodeSdkModule,
  ClaudeCodeSdkNcpAgentRuntimeConfig,
} from "./claude-code-sdk-types.js";
import { buildQueryEnv, resolveClaudeGatewayAccess } from "./claude-code-runtime-utils.js";
import {
  resolveBundledClaudeAgentSdkCliPath,
  resolveCurrentProcessExecutable,
} from "./claude-code-process-resolution.js";
import { probeClaudeCodeSdkExecution } from "./claude-code-execution-probe.js";

const require = createRequire(import.meta.url);
const claudeCodeLoader = require("../claude-code-loader.cjs") as ClaudeCodeLoader;

export type ClaudeCodeSdkCapabilityProbeConfig = Pick<
  ClaudeCodeSdkNcpAgentRuntimeConfig,
  | "apiKey"
  | "authToken"
  | "apiBase"
  | "env"
  | "workingDirectory"
  | "model"
  | "baseQueryOptions"
  | "anthropicGateway"
> & {
  configuredModels?: string[];
  probeTimeoutMs?: number;
  recommendedModel?: string | null;
  allowMissingApiKey?: boolean;
  verifyExecution?: boolean;
  executionProbePrompt?: string;
  executionProbeTimeoutMs?: number;
};

export type ClaudeCodeSdkCapabilityProbeResult = {
  ready: boolean;
  reason?: string | null;
  reasonMessage?: string | null;
  supportedModels?: string[];
  recommendedModel?: string | null;
  discoverySource: "sdk" | "configured" | "none";
};

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
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

function normalizeSupportedModelList(value: unknown): string[] | undefined {
  const list = readStringArray(value);
  if (!list) {
    return undefined;
  }

  const seen = new Set<string>();
  const output: string[] = [];
  for (const entry of list) {
    if (seen.has(entry)) {
      continue;
    }
    seen.add(entry);
    output.push(entry);
  }
  return output.length > 0 ? output : undefined;
}

function normalizeRecommendedModel(params: {
  supportedModels?: string[];
  recommendedModel?: string | null;
}): string | null {
  const recommendedModel = readString(params.recommendedModel);
  if (!recommendedModel) {
    return params.supportedModels?.[0] ?? null;
  }
  if (!params.supportedModels || params.supportedModels.includes(recommendedModel)) {
    return recommendedModel;
  }
  return params.supportedModels?.[0] ?? recommendedModel;
}

function buildConfiguredFallback(
  params: ClaudeCodeSdkCapabilityProbeConfig,
): ClaudeCodeSdkCapabilityProbeResult {
  const supportedModels = normalizeSupportedModelList(params.configuredModels);
  return {
    ready: true,
    reason: null,
    reasonMessage: null,
    supportedModels,
    recommendedModel: normalizeRecommendedModel({
      supportedModels,
      recommendedModel: params.recommendedModel ?? params.model,
    }),
    discoverySource: supportedModels ? "configured" : "none",
  };
}

function toTimeoutError(timeoutMs: number): Error {
  return new Error(`claude capability probe timed out after ${timeoutMs}ms`);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (timeoutMs <= 0) {
    return await promise;
  }
  return await new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(toTimeoutError(timeoutMs)), timeoutMs);
    timeout.unref?.();
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function getInternalQuery(session: {
  query?: {
    initializationResult?: ClaudeCodeQuery["initializationResult"];
    supportedModels?: ClaudeCodeQuery["supportedModels"];
  };
}): {
  initializationResult?: ClaudeCodeQuery["initializationResult"];
  supportedModels?: ClaudeCodeQuery["supportedModels"];
} | null {
  if (!session.query || typeof session.query !== "object") {
    return null;
  }
  return session.query;
}

function normalizeSdkModels(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const seen = new Set<string>();
  const output: string[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const modelValue = readString((entry as { value?: unknown }).value);
    if (!modelValue || seen.has(modelValue)) {
      continue;
    }
    seen.add(modelValue);
    output.push(modelValue);
  }
  return output.length > 0 ? output : undefined;
}

function resolveProbeCliConfig(baseQueryOptions: Record<string, unknown> | undefined): {
  pathToClaudeCodeExecutable?: string;
  executable?: string;
  executableArgs?: string[];
  permissionMode?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
} {
  return {
    pathToClaudeCodeExecutable:
      readString(baseQueryOptions?.pathToClaudeCodeExecutable) ??
      readString(baseQueryOptions?.claudeCodePath) ??
      resolveBundledClaudeAgentSdkCliPath(),
    executable:
      readString(baseQueryOptions?.executable) ??
      resolveCurrentProcessExecutable(),
    executableArgs: readStringArray(baseQueryOptions?.executableArgs),
    permissionMode: readString(baseQueryOptions?.permissionMode) ?? "default",
    allowedTools: readStringArray(baseQueryOptions?.allowedTools) ?? [],
    disallowedTools: readStringArray(baseQueryOptions?.disallowedTools) ?? [],
  };
}

export async function probeClaudeCodeSdkCapability(
  sdk: ClaudeCodeSdkModule,
  config: ClaudeCodeSdkCapabilityProbeConfig,
): Promise<ClaudeCodeSdkCapabilityProbeResult> {
  const apiKey = readString(config.apiKey);
  const authToken = readString(config.authToken);
  if (!apiKey && !authToken && !config.allowMissingApiKey) {
    return {
      ready: false,
      reason: "api_key_missing",
      reasonMessage: "Claude runtime requires a Claude auth source, API key, or gateway credential before it can start.",
      supportedModels: undefined,
      recommendedModel: null,
      discoverySource: "none",
    };
  }

  const seedModel = readString(config.model);
  const fallback = buildConfiguredFallback(config);
  const createSession = sdk.unstable_v2_createSession;
  if (typeof createSession !== "function" || !seedModel) {
    return fallback;
  }

  const cliConfig = resolveProbeCliConfig(config.baseQueryOptions);
  if (!cliConfig.pathToClaudeCodeExecutable) {
    return {
      ready: false,
      reason: "claude_executable_missing",
      reasonMessage: "Claude Code executable is not available. Install Claude Agent SDK correctly or set pathToClaudeCodeExecutable.",
      supportedModels: fallback.supportedModels,
      recommendedModel: fallback.recommendedModel,
      discoverySource: fallback.discoverySource,
    };
  }

  const preparedAccess = await resolveClaudeGatewayAccess({
    apiKey: apiKey ?? "",
    authToken,
    apiBase: config.apiBase,
    anthropicGateway: config.anthropicGateway,
  });

  const session = createSession({
    model: seedModel,
    cwd: config.workingDirectory,
    env: buildQueryEnv({
      sessionId: "claude-capability-probe",
      apiKey: preparedAccess.apiKey,
      authToken: preparedAccess.authToken,
      apiBase: preparedAccess.apiBase,
      model: seedModel,
      workingDirectory: config.workingDirectory,
      env: config.env,
      baseQueryOptions: config.baseQueryOptions,
    }),
    pathToClaudeCodeExecutable: cliConfig.pathToClaudeCodeExecutable,
    executable: cliConfig.executable,
    executableArgs: cliConfig.executableArgs,
    permissionMode: cliConfig.permissionMode,
    allowedTools: cliConfig.allowedTools,
    disallowedTools: cliConfig.disallowedTools,
    persistSession: false,
  });

  try {
    const internalQuery = getInternalQuery(session);
    if (!internalQuery?.supportedModels) {
      return fallback;
    }

    const timeoutMs = Math.max(1000, Math.trunc(config.probeTimeoutMs ?? 5000));
    const [models] = await withTimeout(
      Promise.all([
        internalQuery.supportedModels(),
        internalQuery.initializationResult?.(),
      ]),
      timeoutMs,
    );
    const supportedModels = normalizeSdkModels(models);
    if (!supportedModels) {
      return fallback;
    }

    if (config.verifyExecution !== false) {
      const executionProbe = await probeClaudeCodeSdkExecution({
        sdk,
        config: {
          ...config,
          apiKey: preparedAccess.apiKey,
          authToken: preparedAccess.authToken,
          apiBase: preparedAccess.apiBase,
        },
        cliConfig,
        model: normalizeRecommendedModel({
          supportedModels,
          recommendedModel: config.recommendedModel ?? seedModel,
        }) ?? seedModel,
        withTimeout,
      });

      return {
        ready: executionProbe.ready,
        reason: executionProbe.reason,
        reasonMessage: executionProbe.reasonMessage,
        supportedModels,
        recommendedModel: normalizeRecommendedModel({
          supportedModels,
          recommendedModel: config.recommendedModel ?? seedModel,
        }),
        discoverySource: "sdk",
      };
    }

    return {
      ready: true,
      reason: null,
      reasonMessage: null,
      supportedModels,
      recommendedModel: normalizeRecommendedModel({
        supportedModels,
        recommendedModel: config.recommendedModel ?? seedModel,
      }),
      discoverySource: "sdk",
    };
  } catch (error) {
    const reasonMessage = error instanceof Error ? error.message : "claude capability probe failed";
    return {
      ready: false,
      reason: "probe_failed",
      reasonMessage,
      supportedModels: fallback.supportedModels,
      recommendedModel: fallback.recommendedModel,
      discoverySource: fallback.discoverySource,
    };
  } finally {
    session.close();
  }
}

export async function loadAndProbeClaudeCodeSdkCapability(
  config: ClaudeCodeSdkCapabilityProbeConfig,
): Promise<ClaudeCodeSdkCapabilityProbeResult> {
  const sdk = await claudeCodeLoader.loadClaudeCodeSdkModule();
  return await probeClaudeCodeSdkCapability(sdk, config);
}
