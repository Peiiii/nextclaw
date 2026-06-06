import type { ContextProviderRunContextService } from "@kernel/contributions/context-provider/services/context-provider-run-context.service.js";
import type {
  AgentRunRequest,
  ContextBlock,
  ContextProvider,
} from "@kernel/types/agent-run.types.js";

export class WorkspaceContextProvider implements ContextProvider {
  constructor(private readonly context: ContextProviderRunContextService) {}

  provide = async (
    request: AgentRunRequest,
  ): Promise<readonly ContextBlock[]> => {
    const { runContext } = await this.context.resolve(request);
    return [
      [
        "## Workspace",
        `Your working directory is: ${runContext.effectiveWorkspace}`,
        "Treat this directory as the single global workspace for file operations unless explicitly instructed otherwise.",
      ].join("\n"),
    ];
  };
}
