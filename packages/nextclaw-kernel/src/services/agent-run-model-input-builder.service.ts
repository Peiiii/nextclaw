import { ncpMessageToOpenAiMessages, type LocalAssetStore } from "@nextclaw/ncp-agent-runtime";
import { estimateInputTokens } from "@nextclaw/core";
import type {
  AgentModelInputBuildRequest,
  AgentModelInputBuilder,
} from "@nextclaw/ncp-agent-runtime-next";
import type {
  NcpLLMApiInput,
  NcpMessage,
  OpenAIChatMessage,
} from "@nextclaw/ncp";
import { isContextCompactionProjectionMessage } from "@kernel/features/context-compaction/index.js";
import { stripCompactedSessionOnboardingSections } from "@kernel/utils/agent-onboarding-context.utils.js";
import type { AgentRunMessageProjector } from "./agent-run-message-projector.service.js";
import type { AgentRunModelInputBudgeter } from "./agent-run-model-input-budgeter.service.js";
import { buildProviderTools } from "@kernel/utils/agent-model-input-budget.utils.js";

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
    const projection = this.messageProjector.project({
      sessionId: request.sessionId,
      messages: request.messages,
    });
    const stableProjection = partitionProjectedMessages(
      projection.messages.slice(0, projection.stablePrefixMessageCount),
    );
    const dynamicProjection = partitionProjectedMessages(
      projection.messages.slice(projection.stablePrefixMessageCount),
    );
    const compressedContextBlocks = [
      ...stableProjection.compressedContextBlocks,
      ...dynamicProjection.compressedContextBlocks,
    ];
    const protectedSystemContent = stableProjection.compressedContextBlocks
      .map((block) => block.trim())
      .filter(Boolean)
      .join("\n\n");
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
    const stableConversationMessages = stableProjection.conversationMessages.flatMap((message) =>
      ncpMessageToOpenAiMessages(message, {
        assetStore: this.assetStore,
      }),
    );
    const dynamicConversationMessages = dynamicProjection.conversationMessages.flatMap((message) =>
      ncpMessageToOpenAiMessages(message, {
        assetStore: this.assetStore,
      }),
    );
    const protectedPrefixMessageCount = projection.stablePrefixMessageCount > 0
      ? contextMessages.length + stableConversationMessages.length
      : 0;
    const tools = buildProviderTools(request.tools);
    const pruned = await this.modelInputBudgeter.prune({
      spec: request.spec,
      fixedInputTokens: estimateInputTokens(tools),
      messages: [
        ...contextMessages,
        ...stableConversationMessages,
        ...dynamicConversationMessages,
      ],
      protectedPrefixMessageCount,
      protectedSystemContentChars: protectedSystemContent.length,
    });
    return {
      messages: pruned.messages,
      tools: tools.length > 0 ? tools : undefined,
      model: request.spec.model,
      thinkingLevel: request.spec.thinkingEffort ?? null,
      max_tokens: request.spec.maxTokens,
    };
  };
}
