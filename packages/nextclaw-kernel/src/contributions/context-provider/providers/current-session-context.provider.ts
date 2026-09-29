import type { ContextProviderRunContextService } from "@kernel/contributions/context-provider/services/context-provider-run-context.service.js";
import type {
  AgentRunRequest,
  ContextBlock,
  ContextProvider,
} from "@kernel/types/agent-run.types.js";
export type ContextRuntimeInfo = {
  inspect(workspacePath: string): {
    appName: string;
    host: string;
    distribution: string;
    installationKind?: string | null;
  };
};

export class CurrentSessionContextProvider implements ContextProvider {
  constructor(private readonly context: ContextProviderRunContextService,
    private readonly runtime: ContextRuntimeInfo) {}

  provide = async (
    request: AgentRunRequest,
  ): Promise<readonly ContextBlock[]> => {
    const { runContext } = await this.context.resolve(request);
    const instance = this.runtime.inspect(runContext.effectiveWorkspace);
    const lines = [
      "## Current Self",
      `Identity: ${runContext.profile.displayName} (Agent ID: ${runContext.profile.agentId}), a personal assistant running inside ${instance.appName}.`,
      `Host: ${instance.host}`,
      `Distribution: ${instance.distribution}${instance.installationKind ? ` (${instance.installationKind})` : ""}`,
      "Time handling: do not assume exact minute/second unless the user/tool explicitly provides it.",
      "When a turn includes a time hint, treat it as context for relative-time interpretation in that turn.",
      `Channel: ${runContext.channel}`,
      `Chat ID: ${runContext.chatId}`,
      `Session: ${runContext.sessionKey}`,
      `Model: ${runContext.effectiveModel}`,
      ...(runContext.runtimeThinking ? [`Thinking policy: ${runContext.runtimeThinking}`] : []),
      "For current installation, storage, service, endpoint, or health facts, query the structured status or domain command; do not present documentation defaults as current values.",
    ];
    return [lines.join("\n")];
  };
}
