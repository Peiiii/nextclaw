import {
  buildOpenAiFunctionTool,
  ncpMessageToOpenAiMessages,
  type LocalAssetStore,
} from "@nextclaw/ncp-agent-runtime";
import type {
  AgentModelInputBuildRequest,
  AgentModelInputBuilder,
} from "@nextclaw/ncp-agent-runtime-next";
import type {
  NcpLLMApiInput,
  NcpMessage,
  NcpToolDefinition,
  OpenAIChatMessage,
  OpenAITool,
} from "@nextclaw/ncp";
import { isContextCompactionProjectionMessage } from "@kernel/features/context-compaction/index.js";
import { stripCompactedSessionOnboardingSections } from "@kernel/utils/agent-onboarding-context.utils.js";
import type { AgentRunMessageProjector } from "./agent-run-message-projector.service.js";
import type { AgentRunModelInputBudgeter } from "./agent-run-model-input-budgeter.service.js";

function readSystemContent(messages: OpenAIChatMessage[]): string[] {
  return messages
    .filter((message): message is Extract<OpenAIChatMessage, { role: "system" }> => message.role === "system")
    .map((message) => message.content.trim())
    .filter(Boolean);
}

function partitionProjectedMessages(messages: readonly NcpMessage[]): {
  compressedContextBlocks: string[];
  conversationMessages: NcpMessage[];
} {
  const compressedContextBlocks: string[] = [];
  const conversationMessages: NcpMessage[] = [];
  for (const message of messages) {
    if (!isContextCompactionProjectionMessage(message)) {
      conversationMessages.push(message);
      continue;
    }
    compressedContextBlocks.push(
      ...readSystemContent(ncpMessageToOpenAiMessages(message)),
    );
  }
  return { compressedContextBlocks, conversationMessages };
}

export class AgentRunModelInputBuilder implements AgentModelInputBuilder {
  constructor(
    private readonly messageProjector: AgentRunMessageProjector,
    private readonly modelInputBudgeter: AgentRunModelInputBudgeter,
    private readonly assetStore: LocalAssetStore | null = null,
  ) {}

  build = async (request: AgentModelInputBuildRequest): Promise<NcpLLMApiInput> => {
    const projectedMessages = this.messageProjector.project({
      sessionId: request.sessionId,
      messages: request.messages,
    });
    const {
      compressedContextBlocks,
      conversationMessages: projectedConversationMessages,
    } = partitionProjectedMessages(projectedMessages);
    const contextBlocks = compressedContextBlocks.length > 0
      ? request.contextBlocks.map(stripCompactedSessionOnboardingSections)
      : request.contextBlocks;
    const contextContent = [
      ...compressedContextBlocks,
      ...contextBlocks,
    ]
      .map((block) => block.trim())
      .filter(Boolean)
      .join("\n\n");
    const contextMessages: OpenAIChatMessage[] = contextContent
      ? [{ role: "system", content: contextContent }]
      : [];
    const conversationMessages = projectedConversationMessages.flatMap((message) =>
      ncpMessageToOpenAiMessages(message, {
        assetStore: this.assetStore,
      }),
    );
    const pruned = await this.modelInputBudgeter.prune({
      spec: request.spec,
      messages: [...contextMessages, ...conversationMessages],
    });
    const tools = request.tools.map((tool): OpenAITool =>
      buildOpenAiFunctionTool({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      } satisfies NcpToolDefinition),
    );

    return {
      messages: pruned.messages,
      tools: tools.length > 0 ? tools : undefined,
      model: request.spec.model,
      thinkingLevel: request.spec.thinkingEffort ?? null,
      max_tokens: request.spec.maxTokens,
    };
  };
}
