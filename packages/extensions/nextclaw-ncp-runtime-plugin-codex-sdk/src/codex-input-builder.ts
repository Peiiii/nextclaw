import type { NcpAgentRunInput } from "@nextclaw/ncp";

type RuntimeAgentPromptBuilder = {
  buildRuntimeUserPrompt: (params: {
    workspace?: string;
    sessionKey?: string;
    metadata?: Record<string, unknown>;
    userMessage: string;
  }) => string;
};

function readUserText(input: NcpAgentRunInput): string {
  for (let index = input.messages.length - 1; index >= 0; index -= 1) {
    const message = input.messages[index];
    if (message?.role !== "user") {
      continue;
    }
    const text = message.parts
      .filter((part): part is Extract<typeof message.parts[number], { type: "text" }> => part.type === "text")
      .map((part) => part.text)
      .join("")
      .trim();
    if (text) {
      return text;
    }
  }
  return "";
}

export function buildCodexInputBuilder(
  runtimeAgent: RuntimeAgentPromptBuilder,
  workspace: string,
) {
  return async (input: NcpAgentRunInput): Promise<string> => {
    const userText = readUserText(input);
    const metadata =
      input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
        ? (input.metadata as Record<string, unknown>)
        : {};
    return runtimeAgent.buildRuntimeUserPrompt({
      workspace,
      sessionKey: input.sessionId,
      metadata,
      userMessage: userText,
    });
  };
}
