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
  NcpToolDefinition,
  OpenAIChatMessage,
  OpenAITool,
} from "@nextclaw/ncp";
import type { AgentRunMessageProjector } from "./agent-run-message-projector.service.js";
import type { AgentRunModelInputBudgeter } from "./agent-run-model-input-budgeter.service.js";

export class AgentRunModelInputBuilder implements AgentModelInputBuilder {
  constructor(
    private readonly messageProjector: AgentRunMessageProjector,
    private readonly modelInputBudgeter: AgentRunModelInputBudgeter,
    private readonly assetStore: LocalAssetStore | null = null,
  ) {}

  build = async (request: AgentModelInputBuildRequest): Promise<NcpLLMApiInput> => {
    const contextContent = request.contextBlocks
      .map((block) => block.trim())
      .filter(Boolean)
      .join("\n\n");
    const contextMessages: OpenAIChatMessage[] = contextContent
      ? [{ role: "system", content: contextContent }]
      : [];
    const projectedMessages = this.messageProjector.project({
      sessionId: request.sessionId,
      messages: request.messages,
    });
    const conversationMessages = projectedMessages.flatMap((message) =>
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
