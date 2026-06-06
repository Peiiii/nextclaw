import type { ContextProviderRunContextService } from "@kernel/contributions/context-provider/services/context-provider-run-context.service.js";
import type {
  AgentRunRequest,
  ContextBlock,
  ContextProvider,
} from "@kernel/types/agent-run.types.js";

export class ToolingContextProvider implements ContextProvider {
  constructor(private readonly context: ContextProviderRunContextService) {}

  provide = async (
    request: AgentRunRequest,
  ): Promise<readonly ContextBlock[]> => {
    const { toolCatalog } = await this.context.resolve(request);
    const toolLines =
      toolCatalog.length > 0
        ? toolCatalog.map(
            (tool) =>
              `- ${tool.name}: ${tool.description ?? "No description available"}`,
          )
        : ["- No tools available for this turn."];

    return [
      [
        "## Tooling",
        "Tool availability (filtered by policy):",
        "Tool names are case-sensitive. Call tools exactly as listed.",
        ...toolLines,
        "TOOLS.md does not control tool availability; it is user guidance for how to use external tools.",
        "For long waits, avoid rapid poll loops: use exec with enough yieldMs.",
        "For relative time/date scheduling requests (for example 'in 5 minutes' / '1分钟后'), first check the current local time with an available tool such as exec/date, then convert it to an absolute ISO time with timezone. Do not guess.",
        "If a task is more complex or takes longer, spawn a sub-agent. Completion is push-based: it will auto-announce when done.",
        "Do not poll `subagents list` / `sessions_list` in a loop; only check status on-demand (for intervention, debugging, or when explicitly asked).",
      ].join("\n"),
    ];
  };
}
