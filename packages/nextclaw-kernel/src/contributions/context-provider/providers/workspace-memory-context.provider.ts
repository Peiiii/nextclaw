import type { ContextProviderRunContextService } from "@kernel/contributions/context-provider/services/context-provider-run-context.service.js";
import { truncateContextText } from "@kernel/contributions/context-provider/utils/context-text.utils.js";
import type {
  AgentRunRequest,
  ContextBlock,
  ContextProvider,
} from "@kernel/types/agent-run.types.js";
import { MemoryStore } from "@nextclaw/core";

export class WorkspaceMemoryContextProvider implements ContextProvider {
  constructor(private readonly context: ContextProviderRunContextService) {}

  provide = async (
    request: AgentRunRequest,
  ): Promise<readonly ContextBlock[]> => {
    const { contextConfig, projectContext } =
      await this.context.resolve(request);
    const memoryConfig = contextConfig.memory;
    if (!memoryConfig.enabled) {
      return [];
    }

    const memory = new MemoryStore(
      projectContext.hostWorkspace,
    ).getMemoryContext();
    if (!memory) {
      return [];
    }

    return [
      `# Memory\n\n${truncateContextText(memory, memoryConfig.maxChars)}`,
    ];
  };
}
