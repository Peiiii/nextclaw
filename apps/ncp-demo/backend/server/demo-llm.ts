import type {
  NcpLLMApi,
  NcpLLMApiInput,
  NcpLLMApiOptions,
  OpenAIChatChunk,
} from "@nextclaw/ncp";

export class DemoClockNcpLLMApi implements NcpLLMApi {
  async *generate(
    input: NcpLLMApiInput,
    options?: NcpLLMApiOptions,
  ): AsyncGenerator<OpenAIChatChunk> {
    if (hasToolResult(input.messages)) {
      const text = buildFinalText(input.messages);
      for (const char of text) {
        if (options?.signal?.aborted) {
          break;
        }
        yield {
          choices: [{ index: 0, delta: { content: char } }],
        };
      }
      yield {
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      };
      return;
    }

    const toolCallId = `tool-${Date.now().toString(36)}`;
    const args = JSON.stringify({ timezone: "Asia/Shanghai" });

    yield {
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: 0,
                id: toolCallId,
                type: "function",
                function: {
                  name: "get_current_time",
                  arguments: args.slice(0, Math.ceil(args.length / 2)),
                },
              },
            ],
          },
        },
      ],
    };

    yield {
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: 0,
                function: {
                  arguments: args.slice(Math.ceil(args.length / 2)),
                },
              },
            ],
          },
        },
      ],
    };

    yield {
      choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
    };
  }
}

function hasToolResult(messages: NcpLLMApiInput["messages"]): boolean {
  return messages.some((message) => message.role === "tool");
}

function buildFinalText(messages: NcpLLMApiInput["messages"]): string {
  const latestToolResult = getLatestToolResult(messages);
  const latestUserText = getLatestUserText(messages);
  if (!latestToolResult) {
    return `Echo: ${latestUserText || "(empty)"}`;
  }
  return `Current time is ${latestToolResult}. You asked: ${latestUserText || "(empty)"}`;
}

function getLatestToolResult(messages: NcpLLMApiInput["messages"]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "tool" && typeof message.content === "string") {
      return message.content;
    }
  }
  return "";
}

function getLatestUserText(messages: NcpLLMApiInput["messages"]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "user" && typeof message.content === "string") {
      return message.content;
    }
  }
  return "";
}
