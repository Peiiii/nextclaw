import type {
  NcpLLMApi,
  NcpLLMApiInput,
  NcpLLMApiOptions,
  OpenAIChatChunk,
} from "@nextclaw/ncp";

export type OpenAICompatibleNcpLLMApiConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export class OpenAICompatibleNcpLLMApi implements NcpLLMApi {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(config: OpenAICompatibleNcpLLMApiConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.model = config.model;
  }

  async *generate(
    input: NcpLLMApiInput,
    options?: NcpLLMApiOptions,
  ): AsyncGenerator<OpenAIChatChunk> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      signal: options?.signal,
      body: JSON.stringify({
        model: input.model ?? this.model,
        messages: input.messages,
        tools: input.tools,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      const body = response.body ? await response.text() : "";
      throw new Error(`OpenAI stream request failed (${response.status}): ${body || response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });

      while (true) {
        const frameEnd = buffer.indexOf("\n\n");
        if (frameEnd < 0) {
          break;
        }

        const frame = buffer.slice(0, frameEnd);
        buffer = buffer.slice(frameEnd + 2);

        const chunk = parseOpenAiSseFrame(frame);
        if (!chunk) {
          continue;
        }
        if (chunk === "[DONE]") {
          return;
        }
        yield chunk;
      }
    }

    const tail = decoder.decode();
    if (tail) {
      buffer += tail;
    }

    if (!buffer.trim()) {
      return;
    }

    const chunk = parseOpenAiSseFrame(buffer.trim());
    if (chunk && chunk !== "[DONE]") {
      yield chunk;
    }
  }
}

function parseOpenAiSseFrame(frame: string): OpenAIChatChunk | "[DONE]" | null {
  const lines = frame
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"));

  if (lines.length === 0) {
    return null;
  }

  const payload = lines.map((line) => line.slice(5).trim()).join("\n");
  if (!payload) {
    return null;
  }
  if (payload === "[DONE]") {
    return "[DONE]";
  }

  try {
    return JSON.parse(payload) as OpenAIChatChunk;
  } catch {
    return null;
  }
}
