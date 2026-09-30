import type { ContextProviderRunContextService } from "@kernel/contributions/context-provider/services/context-provider-run-context.service.js";
import { renderAgentBootstrapContext, type BootstrapContextInput } from "@kernel/contributions/context-provider/utils/bootstrap-context.utils.js";
import type { AgentRunRequest, ContextBlock, ContextProvider } from "@kernel/types/agent-run.types.js";
import { CONTEXT_COMPACTION_METADATA_KEY, readCompressedContextCompactionCheckpoint } from "@nextclaw/core";

export class AgentBootstrapContextProvider implements ContextProvider {
  constructor(private readonly context: ContextProviderRunContextService,
    private readonly files: Pick<BootstrapContextInput, "readText" | "readTexts">) {}

  provide = async (request: AgentRunRequest): Promise<readonly ContextBlock[]> => {
    const { contextConfig, projectContext, runContext } = await this.context.resolve(request);
    return [await renderAgentBootstrapContext({
      config: contextConfig.bootstrap,
      agentRoot: projectContext.projectBootstrapRoot ?? projectContext.effectiveWorkspace,
      workspaceRoot: projectContext.hostWorkspace,
      sessionKey: runContext.sessionKey,
      compacted: Boolean(readCompressedContextCompactionCheckpoint(
        runContext.sessionMetadata?.[CONTEXT_COMPACTION_METADATA_KEY],
      )),
      readText: this.files.readText,
      readTexts: this.files.readTexts,
    })];
  };
}
