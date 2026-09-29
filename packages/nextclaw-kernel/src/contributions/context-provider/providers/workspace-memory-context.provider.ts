import type { ContextProviderRunContextService } from "@kernel/contributions/context-provider/services/context-provider-run-context.service.js";
import { truncateContextText } from "@kernel/contributions/context-provider/utils/context-text.utils.js";
import type {
  AgentRunRequest,
  ContextBlock,
  ContextProvider,
} from "@kernel/types/agent-run.types.js";
import { renderMemoryContext } from "@nextclaw/core";
import type { BootstrapContextInput } from "@kernel/contributions/context-provider/utils/bootstrap-context.utils.js";

export class WorkspaceMemoryContextProvider implements ContextProvider {
  constructor(private readonly context: ContextProviderRunContextService,
    private readonly files: Pick<BootstrapContextInput, "readText">) {}

  provide = async (
    request: AgentRunRequest,
  ): Promise<readonly ContextBlock[]> => {
    const { contextConfig, projectContext } =
      await this.context.resolve(request);
    const memoryConfig = contextConfig.memory;
    if (!memoryConfig.enabled) {
      return [];
    }

    const root = projectContext.hostWorkspace;
    const [workspaceMemory, longTerm, today] = await Promise.all([
      this.files.readText(root, "MEMORY.md"), this.files.readText(root, "memory/MEMORY.md"),
      this.files.readText(root, `memory/${new Date().toISOString().slice(0, 10)}.md`),
    ]);
    const memory = renderMemoryContext({ workspaceMemory, longTerm, today });
    if (!memory) {
      return [];
    }

    return [
      `# Memory\n\n${truncateContextText(memory, memoryConfig.maxChars)}`,
    ];
  };
}
