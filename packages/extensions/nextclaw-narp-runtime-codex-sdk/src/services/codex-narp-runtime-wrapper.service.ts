import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type {
  NcpAgentRunInput,
  NcpAgentRunOptions,
  NcpAgentRuntime,
  NcpEndpointEvent,
} from "@nextclaw/ncp";
import {
  NarpStdioRuntimeWrapper,
  type NarpStdioRuntimeWrapperContext,
} from "@nextclaw/nextclaw-narp-stdio-runtime-wrapper";
import {
  CodexAppServerNcpAgentRuntime,
  CodexLiveOutputStream,
  buildCodexBridgeModelProviderId,
  ensureCodexOpenAiResponsesBridge,
  type CodexSdkNcpAgentRuntimeConfig,
  type CodexOpenAiResponsesBridgeResult,
  type CodexOpenAiResponsesBridgeRuntimeConfig,
} from "@nextclaw/nextclaw-ncp-runtime-codex-sdk";

const NARP_API_MODE_HEADER = "x-nextclaw-narp-api-mode";
const CODEX_NARP_DEBUG_CONFIG_ENV = "NEXTCLAW_CODEX_NARP_DEBUG_CONFIG";
const RUNTIME_DEFAULT_MODEL_VALUE = "__nextclaw_runtime_default__";

export type CodexNarpRuntimeFactory = (
  config: CodexSdkNcpAgentRuntimeConfig,
) => NcpAgentRuntime;

export type CodexResponsesBridgeFactory = (
  config: CodexOpenAiResponsesBridgeRuntimeConfig,
) => Promise<CodexOpenAiResponsesBridgeResult>;

type CodexReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh";

class DeferredCodexNarpRuntime implements NcpAgentRuntime {
  private runtimePromise: Promise<NcpAgentRuntime> | null = null;

  constructor(private readonly createRuntime: () => Promise<NcpAgentRuntime>) {}

  run = async function* (
    this: DeferredCodexNarpRuntime,
    input: NcpAgentRunInput,
    options?: NcpAgentRunOptions,
  ): AsyncGenerator<NcpEndpointEvent> {
    if (!this.runtimePromise) {
      this.runtimePromise = this.createRuntime();
    }
    const runtime = await this.runtimePromise;
    yield* runtime.run(input, options);
  };
}

export class CodexNarpRuntimeWrapper {
  constructor(
    private readonly createRuntime: CodexNarpRuntimeFactory = (
      config,
    ) => new CodexAppServerNcpAgentRuntime(config),
    private readonly ensureResponsesBridge: CodexResponsesBridgeFactory =
      ensureCodexOpenAiResponsesBridge,
  ) {}

  start = (): void => {
    new NarpStdioRuntimeWrapper({
      agentName: "NextClaw Codex NARP",
      createRuntime: (context) => this.createCodexRuntime(context),
    }).start();
  };

  createCodexRuntime = (context: NarpStdioRuntimeWrapperContext): NcpAgentRuntime => {
    return new DeferredCodexNarpRuntime(async () =>
      this.createRuntime(await this.buildRuntimeConfig(context)),
    );
  };

  buildRuntimeConfig = (
    context: NarpStdioRuntimeWrapperContext,
  ): Promise<CodexSdkNcpAgentRuntimeConfig> => {
    const { cwd, modelId, promptMeta, sessionId, setSessionMetadata } = context;
    const providerRoute = promptMeta.providerRoute;
    const sessionMetadata = promptMeta.sessionMetadata ?? {};
    const useCodexRuntimeDefault = isRuntimeDefaultModelValue(
      readString(sessionMetadata.preferred_model) ??
        readString(sessionMetadata.preferredModel) ??
        readString(sessionMetadata.model) ??
        readString(modelId),
    );
    const providerLocalModel = useCodexRuntimeDefault
      ? undefined
      : stripProviderPrefix(readString(providerRoute?.model)) ??
        stripProviderPrefix(readString(modelId)) ??
        readString(process.env.NEXTCLAW_MODEL);
    const upstreamApiBase =
      useCodexRuntimeDefault
        ? undefined
        : readString(providerRoute?.apiBase) ?? readString(process.env.NEXTCLAW_API_BASE);
    const externalModelProvider = resolveExternalModelProvider({
      apiBase: upstreamApiBase,
      modelId,
    });

    return this.resolveRuntimeConfig({
      apiKey:
        (useCodexRuntimeDefault
          ? undefined
          : readString(providerRoute?.apiKey) ?? readString(process.env.NEXTCLAW_API_KEY)) ??
        "",
      cwd,
      externalModelProvider,
      providerLocalModel,
      sessionId,
      sessionMetadata,
      setSessionMetadata,
      threadModel: useCodexRuntimeDefault
        ? undefined
        : readString(modelId) ??
          composeModelRoute({
            modelProvider: externalModelProvider,
            providerLocalModel,
          }) ??
          providerLocalModel,
      upstreamApiBase,
      upstreamExtraHeaders: providerRoute?.headers,
    });
  };

  private resolveRuntimeConfig = async (params: {
    apiKey: string;
    cwd?: string;
    externalModelProvider?: string;
    providerLocalModel?: string;
    sessionId: string;
    sessionMetadata: Record<string, unknown>;
    threadModel?: string;
    upstreamApiBase?: string;
    upstreamExtraHeaders?: Record<string, string>;
    setSessionMetadata?: CodexSdkNcpAgentRuntimeConfig["setSessionMetadata"];
  }): Promise<CodexSdkNcpAgentRuntimeConfig> => {
    const {
      apiKey,
      cwd,
      externalModelProvider,
      providerLocalModel,
      sessionId,
      sessionMetadata,
      setSessionMetadata,
      threadModel: requestedThreadModel,
      upstreamApiBase,
      upstreamExtraHeaders,
    } = params;
    const bridgeModelProvider =
      upstreamApiBase && shouldUseResponsesBridge({
        apiBase: upstreamApiBase,
        headers: upstreamExtraHeaders,
      })
        ? buildCodexBridgeModelProviderId(externalModelProvider ?? "chat")
        : undefined;
    const liveOutputStream = new CodexLiveOutputStream();
    const bridge = bridgeModelProvider
      ? await this.ensureResponsesBridge({
          upstreamApiBase: upstreamApiBase ?? "",
          upstreamApiKey: apiKey,
          upstreamExtraHeaders: stripInternalRouteHeaders(upstreamExtraHeaders),
          defaultModel: providerLocalModel,
          outputObserver: liveOutputStream,
          upstreamReasoningSplit: isMiniMaxApiBase(upstreamApiBase ?? ""),
          modelPrefixes: [
            externalModelProvider ?? "",
            bridgeModelProvider,
          ],
        })
      : null;
    const apiBase = bridge?.baseUrl ?? upstreamApiBase;
    const modelProvider = bridgeModelProvider ?? externalModelProvider;
    const codexPathOverride =
      readString(process.env.NEXTCLAW_CODEX_PATH) ??
      readString(process.env.CODEX_PATH);
    const modelReasoningEffort =
      readReasoningEffort(sessionMetadata.preferred_thinking) ??
      readReasoningEffort(sessionMetadata.thinking);
    const threadModel = bridgeModelProvider
      ? composeModelRoute({
          modelProvider: bridgeModelProvider,
          providerLocalModel,
        })
      : requestedThreadModel;

    const threadModelScope = threadModel ?? RUNTIME_DEFAULT_MODEL_VALUE;
    const config = {
      sessionId,
      apiKey,
      apiBase,
      model: providerLocalModel,
      threadId: resolveReusableThreadId(sessionMetadata, threadModelScope),
      ...(codexPathOverride ? { codexPathOverride } : {}),
      sessionMetadata,
      ...(setSessionMetadata ? { setSessionMetadata } : {}),
      liveOutputStream: bridge ? liveOutputStream : undefined,
      cliConfig: buildCodexCliConfig({
        apiBase,
        modelProvider,
        showRawAgentReasoning: Boolean(modelReasoningEffort),
      }),
      threadOptions: {
        ...(threadModel ? { model: threadModel } : {}),
        workingDirectory: cwd,
        skipGitRepoCheck: true,
        ...(modelReasoningEffort ? { modelReasoningEffort } : {}),
      },
    };
    logCodexRuntimeConfig({
      bridgeModelProvider,
      config,
      externalModelProvider,
      providerLocalModel,
      requestedThreadModel,
      sessionMetadata,
      threadModel,
    });
    return config;
  };
}

function resolveReusableThreadId(
  sessionMetadata: Record<string, unknown>,
  threadModelScope: string,
): string | null {
  const threadId = readString(sessionMetadata.codex_thread_id);
  if (!threadId) {
    return null;
  }
  const threadScope = readString(sessionMetadata.codex_thread_model);
  if (!threadScope) {
    return null;
  }
  return threadScope === threadModelScope ? threadId : null;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function stripProviderPrefix(value: string | undefined): string | undefined {
  const normalized = readString(value);
  if (!normalized) {
    return undefined;
  }
  const slashIndex = normalized.indexOf("/");
  if (slashIndex <= 0) {
    return normalized;
  }
  return readString(normalized.slice(slashIndex + 1));
}

function isRuntimeDefaultModelValue(value: string | undefined): boolean {
  return value === RUNTIME_DEFAULT_MODEL_VALUE;
}

function readReasoningEffort(value: unknown): CodexReasoningEffort | undefined {
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

function readModelProvider(value: string | undefined): string | undefined {
  const normalized = readString(value);
  if (!normalized) {
    return undefined;
  }
  const slashIndex = normalized.indexOf("/");
  if (slashIndex <= 0) {
    return undefined;
  }
  return readString(normalized.slice(0, slashIndex));
}

function composeModelRoute(params: {
  modelProvider?: string;
  providerLocalModel?: string;
}): string | undefined {
  const { modelProvider, providerLocalModel } = params;
  if (!modelProvider || !providerLocalModel) {
    return undefined;
  }
  return `${modelProvider}/${providerLocalModel}`;
}

function buildCodexCliConfig(params: {
  apiBase?: string;
  modelProvider?: string;
  showRawAgentReasoning?: boolean;
}): CodexSdkNcpAgentRuntimeConfig["cliConfig"] | undefined {
  const { apiBase, modelProvider, showRawAgentReasoning } = params;
  if (!modelProvider && !showRawAgentReasoning) {
    return undefined;
  }
  const config: Record<string, unknown> = {};
  if (showRawAgentReasoning) {
    config.show_raw_agent_reasoning = true;
  }
  if (modelProvider) {
    config.model_provider = modelProvider;
    config.preferred_auth_method = "apikey";
  }
  if (apiBase && modelProvider) {
    config.model_providers = {
      [modelProvider]: {
        name: modelProvider,
        base_url: apiBase,
        wire_api: "responses",
        requires_openai_auth: true,
      },
    };
  }
  return config as CodexSdkNcpAgentRuntimeConfig["cliConfig"];
}

function logCodexRuntimeConfig(params: {
  bridgeModelProvider?: string;
  config: CodexSdkNcpAgentRuntimeConfig;
  externalModelProvider?: string;
  providerLocalModel?: string;
  requestedThreadModel?: string;
  sessionMetadata: Record<string, unknown>;
  threadModel?: string;
}): void {
  if (process.env[CODEX_NARP_DEBUG_CONFIG_ENV] !== "1") {
    return;
  }
  const {
    bridgeModelProvider,
    config,
    externalModelProvider,
    providerLocalModel,
    requestedThreadModel,
    sessionMetadata,
    threadModel,
  } = params;
  const cliConfig = config.cliConfig as Record<string, unknown> | undefined;
  const modelProviders = cliConfig?.model_providers;
  const snapshot = {
    bridgeModelProvider: bridgeModelProvider ?? null,
    externalModelProvider: externalModelProvider ?? null,
    hasApiBase: Boolean(config.apiBase),
    hasApiKey: Boolean(config.apiKey),
    hasLiveOutputStream: Boolean(config.liveOutputStream),
    providerLocalModel: providerLocalModel ?? null,
    requestedThreadModel: requestedThreadModel ?? null,
    sessionId: config.sessionId,
      sessionMetadata: {
        codex_thread_id: readString(sessionMetadata.codex_thread_id) ?? null,
        codex_thread_model: readString(sessionMetadata.codex_thread_model) ?? null,
        model: readString(sessionMetadata.model) ?? null,
        preferred_model: readString(sessionMetadata.preferred_model) ?? null,
        preferred_thinking: readString(sessionMetadata.preferred_thinking) ?? null,
      thinking: readString(sessionMetadata.thinking) ?? null,
    },
    sdkConfig: {
      cliConfig: cliConfig
        ? {
            model_provider: readString(cliConfig.model_provider) ?? null,
            model_providers:
              modelProviders && typeof modelProviders === "object" && !Array.isArray(modelProviders)
                ? Object.keys(modelProviders)
                : [],
            preferred_auth_method: readString(cliConfig.preferred_auth_method) ?? null,
            show_raw_agent_reasoning: cliConfig.show_raw_agent_reasoning === true,
          }
        : null,
      model: config.model ?? null,
      threadId: config.threadId ?? null,
      threadOptions: {
        model: config.threadOptions?.model ?? null,
        modelReasoningEffort: config.threadOptions?.modelReasoningEffort ?? null,
        skipGitRepoCheck: config.threadOptions?.skipGitRepoCheck ?? null,
        workingDirectory: config.threadOptions?.workingDirectory ?? null,
      },
    },
    threadModel: threadModel ?? null,
    ts: new Date().toISOString(),
  };
  const line = `[nextclaw-codex-narp] runtime-config ${JSON.stringify(snapshot)}`;
  console.error(line);
  appendDebugLog(snapshot);
}

function appendDebugLog(snapshot: Record<string, unknown>): void {
  try {
    const home = readString(process.env.NEXTCLAW_HOME) ?? join(homedir(), ".nextclaw");
    const logPath = join(home, "logs", "codex-narp-runtime-config.jsonl");
    mkdirSync(dirname(logPath), { recursive: true });
    appendFileSync(logPath, `${JSON.stringify(snapshot)}\n`, "utf8");
  } catch (error) {
    console.error(
      `[nextclaw-codex-narp] failed to write runtime config debug log: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function readApiMode(headers: Record<string, string> | undefined): string | undefined {
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (key.toLowerCase() === NARP_API_MODE_HEADER) {
      return readString(value)?.toLowerCase();
    }
  }
  return undefined;
}

function shouldUseResponsesBridge(params: {
  apiBase?: string;
  headers?: Record<string, string>;
}): boolean {
  const apiMode = readApiMode(params.headers);
  if (apiMode === "chat_completions") {
    return true;
  }
  return Boolean(params.apiBase && isMiniMaxApiBase(params.apiBase));
}

function stripInternalRouteHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (key.toLowerCase() === NARP_API_MODE_HEADER) {
      continue;
    }
    out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function resolveExternalModelProvider(params: {
  apiBase?: string;
  modelId?: string;
}): string | undefined {
  return readModelProvider(params.modelId) ??
    (params.apiBase && isMiniMaxApiBase(params.apiBase) ? "minimax" : undefined);
}

function isMiniMaxApiBase(apiBase: string): boolean {
  try {
    const host = new URL(apiBase).hostname.toLowerCase();
    return host === "api.minimaxi.com" || host.endsWith(".minimaxi.com");
  } catch {
    return apiBase.toLowerCase().includes("api.minimaxi.com");
  }
}
