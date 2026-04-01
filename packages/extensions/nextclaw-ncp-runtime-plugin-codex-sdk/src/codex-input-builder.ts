import type { NcpAgentRunInput } from "@nextclaw/ncp";

type RuntimeAgentPromptBuilder = {
  buildRuntimeUserPrompt: (params: {
    workspace?: string;
    hostWorkspace?: string;
    sessionKey?: string;
    metadata?: Record<string, unknown>;
    userMessage: string;
  }) => string;
};

function readMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

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
  params: {
    workspace: string;
    hostWorkspace?: string;
    sessionMetadata?: Record<string, unknown>;
  },
) {
  return async (input: NcpAgentRunInput): Promise<string> => {
    const userText = readUserText(input);
    const metadata = {
      ...readMetadata(params.sessionMetadata),
      ...readMetadata(input.metadata),
    };
    const prompt = runtimeAgent.buildRuntimeUserPrompt({
      workspace: params.workspace,
      hostWorkspace: params.hostWorkspace,
      sessionKey: input.sessionId,
      metadata,
      userMessage: userText,
    });
    return prompt;
  };
}
