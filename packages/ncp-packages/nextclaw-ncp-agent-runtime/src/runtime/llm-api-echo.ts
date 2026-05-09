import type {
  NcpLLMApi,
  NcpLLMApiInput,
  NcpLLMApiOptions,
  OpenAIChatChunk,
} from "@nextclaw/ncp";

function getLastUserContent(messages: NcpLLMApiInput["messages"]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    if (typeof m.content === "string") return m.content;
    if (Array.isArray(m.content)) {
      return m.content
        .map((p) => (p.type === "text" ? p.text : ""))
        .join("");
    }
  }
  return "";
}

export class EchoNcpLLMApi implements NcpLLMApi {
  generate = async function* (
    input: NcpLLMApiInput,
    options?: NcpLLMApiOptions,
  ): AsyncGenerator<OpenAIChatChunk> {
    const text = getLastUserContent(input.messages);
    const signal = options?.signal;
    for (const char of text) {
      if (signal?.aborted) break;
      yield {
        choices: [{ index: 0, delta: { content: char } }],
      };
    }
    yield {
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 0, completion_tokens: text.length, total_tokens: text.length },
    };
  };
}
