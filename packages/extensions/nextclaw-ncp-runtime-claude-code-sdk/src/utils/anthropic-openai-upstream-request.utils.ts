import {
  type AnthropicMessagesRequest,
  readNumber,
  readString,
  toOpenAiMessages,
  toOpenAiTools,
  withTrailingSlash,
} from "./anthropic-openai-bridge-payload.utils.js";

function isMiniMaxApiBase(apiBase: string): boolean {
  try {
    const host = new URL(apiBase).hostname.toLowerCase();
    return host === "api.minimaxi.com" || host.endsWith(".minimaxi.com");
  } catch {
    return apiBase.toLowerCase().includes("api.minimaxi.com");
  }
}

function stripProviderPrefix(model: string): string {
  const separatorIndex = model.indexOf("/");
  return separatorIndex >= 0 ? model.slice(separatorIndex + 1) : model;
}

export function buildOpenAiCompatibleUpstreamRequest(params: {
  config: {
    upstreamApiBase: string;
    upstreamApiKey?: string;
  };
  body: AnthropicMessagesRequest;
  stream: boolean;
}): {
  request: {
    url: string;
    init: RequestInit;
  };
} {
  const { body, config, stream } = params;
  const upstreamUrl = new URL("chat/completions", withTrailingSlash(config.upstreamApiBase));
  const tools = toOpenAiTools(body.tools);
  return {
    request: {
      url: upstreamUrl.toString(),
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(readString(config.upstreamApiKey)
            ? {
                Authorization: `Bearer ${config.upstreamApiKey!.trim()}`,
              }
            : {}),
        },
        body: JSON.stringify({
          model: stripProviderPrefix(readString(body.model) ?? "default"),
          messages: toOpenAiMessages(body),
          ...(tools ? { tools, tool_choice: "auto" } : {}),
          ...(isMiniMaxApiBase(config.upstreamApiBase) ? { reasoning_split: true } : {}),
          ...(stream ? { stream: true, stream_options: { include_usage: true } } : {}),
          max_tokens: Math.max(16, Math.trunc(readNumber(body.max_tokens) ?? 1024)),
        }),
      },
    },
  };
}
