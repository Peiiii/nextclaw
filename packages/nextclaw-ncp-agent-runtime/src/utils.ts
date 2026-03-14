import type {
  NcpLLMApiInput,
  NcpToolCallResult,
  OpenAIChatMessage,
} from "@nextclaw/ncp";

export function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

export function parseToolArgs(args: unknown): unknown {
  if (typeof args === "string") {
    try {
      return JSON.parse(args) as unknown;
    } catch {
      return args;
    }
  }
  return args;
}

export function appendToolRoundToInput(
  input: NcpLLMApiInput,
  text: string,
  toolResults: ReadonlyArray<NcpToolCallResult>,
): NcpLLMApiInput {
  const assistantMsg: OpenAIChatMessage = {
    role: "assistant",
    content: text || null,
    tool_calls: toolResults.map((tr) => ({
      id: tr.toolCallId,
      type: "function" as const,
      function: {
        name: tr.toolName,
        arguments:
          typeof tr.args === "string" ? tr.args : JSON.stringify(tr.args ?? {}),
      },
    })),
  };
  const toolMsgs: OpenAIChatMessage[] = toolResults.map((tr) => ({
    role: "tool" as const,
    content:
      typeof tr.result === "string" ? tr.result : JSON.stringify(tr.result ?? {}),
    tool_call_id: tr.toolCallId,
  }));
  return {
    ...input,
    messages: [...input.messages, assistantMsg, ...toolMsgs],
  };
}
