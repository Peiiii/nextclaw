import type { NcpAgentRuntime } from "@nextclaw/ncp";
import {
  NarpStdioRuntimeWrapper,
  type NarpStdioRuntimeWrapperContext,
} from "@nextclaw/nextclaw-narp-stdio-runtime-wrapper";
import {
  ClaudeCodeSdkNcpAgentRuntime,
  type ClaudeCodeSdkNcpAgentRuntimeConfig,
} from "@nextclaw/nextclaw-ncp-runtime-claude-code-sdk";

const NARP_API_MODE_HEADER = "x-nextclaw-narp-api-mode";

export type ClaudeCodeNarpRuntimeFactory = (
  config: ClaudeCodeSdkNcpAgentRuntimeConfig,
) => NcpAgentRuntime;

export class ClaudeCodeNarpRuntimeWrapper {
  constructor(
    private readonly createRuntime: ClaudeCodeNarpRuntimeFactory = (
      config,
    ) => new ClaudeCodeSdkNcpAgentRuntime(config),
  ) {}

  start = (): void => {
    new NarpStdioRuntimeWrapper({
      agentName: "NextClaw Claude Code NARP",
      createRuntime: (context) => this.createClaudeCodeRuntime(context),
    }).start();
  };

  createClaudeCodeRuntime = (
    context: NarpStdioRuntimeWrapperContext,
  ): NcpAgentRuntime => this.createRuntime(this.buildRuntimeConfig(context));

  buildRuntimeConfig = (
    context: NarpStdioRuntimeWrapperContext,
  ): ClaudeCodeSdkNcpAgentRuntimeConfig => {
    const { cwd, modelId, promptMeta, sessionId } = context;
    const providerRoute = promptMeta.providerRoute;
    const sessionMetadata = promptMeta.sessionMetadata ?? {};
    const apiKey =
      readString(providerRoute?.apiKey) ??
      readString(process.env.NEXTCLAW_API_KEY) ??
      readString(process.env.ANTHROPIC_API_KEY) ??
      "";
    const apiBase = resolveClaudeCompatibleApiBase(
      readString(providerRoute?.apiBase) ??
        readString(process.env.NEXTCLAW_API_BASE) ??
        readString(process.env.ANTHROPIC_BASE_URL) ??
        readString(process.env.ANTHROPIC_API_URL),
      shouldUseAnthropicGateway(providerRoute?.headers),
    );
    const authToken =
      readString(process.env.ANTHROPIC_AUTH_TOKEN) ??
      readString(process.env.CLAUDE_CODE_OAUTH_TOKEN) ??
      resolveClaudeCompatibleAuthToken({ apiBase, apiKey });
    const model =
      readString(providerRoute?.model) ??
      readString(modelId) ??
      readString(process.env.NEXTCLAW_MODEL) ??
      readString(process.env.ANTHROPIC_MODEL);

    return {
      sessionId,
      apiKey,
      authToken,
      apiBase,
      model,
      workingDirectory: cwd,
      sessionRuntimeId: readString(sessionMetadata.claude_session_id) ?? null,
      sessionMetadata,
      baseQueryOptions: {
        permissionMode: "bypassPermissions",
        includePartialMessages: true,
      },
      ...(apiBase && shouldUseAnthropicGateway(providerRoute?.headers)
        ? {
            anthropicGateway: {
              upstreamApiBase: apiBase,
              upstreamApiKey: apiKey,
            },
          }
        : {}),
    };
  };
}

function readApiMode(headers: Record<string, string> | undefined): string | undefined {
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (key.toLowerCase() === NARP_API_MODE_HEADER) {
      return readString(value)?.toLowerCase();
    }
  }
  return undefined;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeApiBase(value: string | undefined): string | undefined {
  return readString(value)?.replace(/\/+$/, "");
}

function resolveClaudeCompatibleApiBase(
  value: string | undefined,
  shouldPreserveOpenAiBase = false,
): string | undefined {
  const apiBase = normalizeApiBase(value);
  if (!apiBase || shouldPreserveOpenAiBase || !isMiniMaxApiBase(apiBase)) {
    return apiBase;
  }
  if (apiBase.endsWith("/anthropic")) {
    return apiBase;
  }
  return `${apiBase.replace(/\/v1$/i, "")}/anthropic`;
}

function resolveClaudeCompatibleAuthToken(params: {
  apiBase?: string;
  apiKey: string;
}): string | undefined {
  return params.apiBase && isMiniMaxApiBase(params.apiBase)
    ? readString(params.apiKey)
    : undefined;
}

function isMiniMaxApiBase(apiBase: string): boolean {
  try {
    const host = new URL(apiBase).hostname.toLowerCase();
    return host === "api.minimaxi.com" || host.endsWith(".minimaxi.com");
  } catch {
    return apiBase.toLowerCase().includes("api.minimaxi.com");
  }
}

function shouldUseAnthropicGateway(headers: Record<string, string> | undefined): boolean {
  return readApiMode(headers) === "chat_completions";
}
