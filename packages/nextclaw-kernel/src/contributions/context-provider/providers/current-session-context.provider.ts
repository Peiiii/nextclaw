import type { ContextProviderRunContextService } from "@kernel/contributions/context-provider/services/context-provider-run-context.service.js";
import type {
  AgentRunRequest,
  ContextBlock,
  ContextProvider,
} from "@kernel/types/agent-run.types.js";

export class CurrentSessionContextProvider implements ContextProvider {
  constructor(private readonly context: ContextProviderRunContextService) {}

  provide = async (
    request: AgentRunRequest,
  ): Promise<readonly ContextBlock[]> => {
    const { runContext } = await this.context.resolve(request);
    const lines = [
      "## Current Session",
      `Channel: ${runContext.channel}`,
      `Chat ID: ${runContext.chatId}`,
      `Session: ${runContext.sessionKey}`,
    ];
    if (runContext.runtimeThinking) {
      lines.push(`Thinking policy: ${runContext.runtimeThinking}`);
    }
    return [lines.join("\n")];
  };
}
