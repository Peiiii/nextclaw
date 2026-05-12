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
  CodexSdkNcpAgentRuntime,
  type CodexSdkNcpAgentRuntimeConfig,
} from "@nextclaw/nextclaw-ncp-runtime-codex-sdk";
import {
  buildCodexBridgeModelProviderId,
  ensureCodexOpenAiResponsesBridge,
  type CodexOpenAiResponsesBridgeConfig,
  type CodexOpenAiResponsesBridgeResult,
} from "@nextclaw/nextclaw-ncp-runtime-plugin-codex-sdk";

const NARP_API_MODE_HEADER = "x-nextclaw-narp-api-mode";

export type CodexNarpRuntimeFactory = (
  config: CodexSdkNcpAgentRuntimeConfig,
) => NcpAgentRuntime;

export type CodexResponsesBridgeFactory = (
  config: CodexOpenAiResponsesBridgeConfig,
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
    ) => new CodexSdkNcpAgentRuntime(config),
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
    const { cwd, modelId, promptMeta, sessionId } = context;
    const providerRoute = promptMeta.providerRoute;
    const sessionMetadata = promptMeta.sessionMetadata ?? {};
    const providerLocalModel =
      stripProviderPrefix(readString(providerRoute?.model)) ??
      stripProviderPrefix(readString(modelId)) ??
      readString(process.env.NEXTCLAW_MODEL);
    const upstreamApiBase =
      readString(providerRoute?.apiBase) ??
      readString(process.env.NEXTCLAW_API_BASE);
    const externalModelProvider = resolveExternalModelProvider({
      apiBase: upstreamApiBase,
      modelId,
    });

    return this.resolveRuntimeConfig({
      apiKey:
        readString(providerRoute?.apiKey) ??
        readString(process.env.NEXTCLAW_API_KEY) ??
        "",
      cwd,
      externalModelProvider,
      providerLocalModel,
      sessionId,
      sessionMetadata,
      threadModel:
        readString(modelId) ??
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
  }): Promise<CodexSdkNcpAgentRuntimeConfig> => {
    const {
      apiKey,
      cwd,
      externalModelProvider,
      providerLocalModel,
      sessionId,
      sessionMetadata,
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
    const bridge = bridgeModelProvider
      ? await this.ensureResponsesBridge({
          upstreamApiBase: upstreamApiBase ?? "",
          upstreamApiKey: apiKey,
          upstreamExtraHeaders: stripInternalRouteHeaders(upstreamExtraHeaders),
          defaultModel: providerLocalModel,
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

    return {
      sessionId,
      apiKey,
      apiBase,
      model: providerLocalModel,
      threadId: readString(sessionMetadata.codex_thread_id) ?? null,
      ...(codexPathOverride ? { codexPathOverride } : {}),
      sessionMetadata,
      cliConfig: buildCodexCliConfig({
        apiBase,
        modelProvider,
      }),
      threadOptions: {
        ...(threadModel ? { model: threadModel } : {}),
        workingDirectory: cwd ?? process.cwd(),
        skipGitRepoCheck: true,
        ...(modelReasoningEffort ? { modelReasoningEffort } : {}),
      },
    };
  };
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
}): CodexSdkNcpAgentRuntimeConfig["cliConfig"] | undefined {
  const { apiBase, modelProvider } = params;
  if (!modelProvider) {
    return undefined;
  }
  const config: Record<string, unknown> = {
    model_provider: modelProvider,
    preferred_auth_method: "apikey",
  };
  if (apiBase) {
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
