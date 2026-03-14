import type { NcpMessage } from "@nextclaw/ncp";
import type {
  NcpContextBuilder,
  NcpContextPrepareOptions,
  NcpLLMApiInput,
  OpenAIChatMessage,
  OpenAITool,
} from "@nextclaw/ncp";
import type { NcpAgentRunInput } from "@nextclaw/ncp";
import type { NcpToolRegistry } from "@nextclaw/ncp";

function messageToOpenAI(msg: NcpMessage): OpenAIChatMessage[] {
  const role = msg.role as "user" | "assistant" | "system" | "tool";
  const parts = msg.parts ?? [];

  if (role === "user" || role === "system") {
    const text = parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("");
    return [{ role, content: text }];
  }

  if (role === "assistant") {
    const texts: string[] = [];
    const toolInvocations: Array<{
      toolCallId: string;
      toolName: string;
      args: unknown;
      result: unknown;
    }> = [];

    for (const p of parts) {
      if (p.type === "text") {
        texts.push(p.text);
      }
      if (p.type === "tool-invocation" && p.state === "result" && p.result !== undefined) {
        toolInvocations.push({
          toolCallId: p.toolCallId ?? "",
          toolName: p.toolName,
          args: p.args ?? {},
          result: p.result,
        });
      }
    }

    const text = texts.join("");
    const out: OpenAIChatMessage[] = [];

    if (toolInvocations.length > 0) {
      out.push({
        role: "assistant",
        content: text || null,
        tool_calls: toolInvocations.map((t) => ({
          id: t.toolCallId,
          type: "function" as const,
          function: {
            name: t.toolName,
            arguments:
              typeof t.args === "string" ? t.args : JSON.stringify(t.args ?? {}),
          },
        })),
      });
      for (const t of toolInvocations) {
        out.push({
          role: "tool",
          content: typeof t.result === "string" ? t.result : JSON.stringify(t.result),
          tool_call_id: t.toolCallId,
        });
      }
    } else {
      out.push({ role: "assistant", content: text });
    }
    return out;
  }

  return [];
}

export class DefaultNcpContextBuilder implements NcpContextBuilder {
  constructor(private readonly toolRegistry?: NcpToolRegistry) {}

  prepare = (
    input: NcpAgentRunInput,
    options?: NcpContextPrepareOptions,
  ): NcpLLMApiInput => {
    const maxMessages = options?.maxMessages ?? 50;
    const sessionMessages = options?.sessionMessages ?? [];
    const systemPrompt = options?.systemPrompt;

    const messages: OpenAIChatMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }

    for (const msg of sessionMessages.slice(-maxMessages)) {
      messages.push(...messageToOpenAI(msg));
    }

    for (const msg of input.messages) {
      messages.push(...messageToOpenAI(msg));
    }

    const tools: OpenAITool[] | undefined = this.toolRegistry
      ? this.toolRegistry.getToolDefinitions().map((d) => ({
          type: "function" as const,
          function: {
            name: d.name,
            description: d.description,
            parameters: d.parameters,
          },
        }))
      : undefined;

    return {
      messages,
      tools: tools && tools.length > 0 ? tools : undefined,
    };
  };
}
