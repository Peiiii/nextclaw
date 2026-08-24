import type { ContextProviderRunContextService } from "@kernel/contributions/context-provider/services/context-provider-run-context.service.js";
import type {
  AgentRunRequest,
  ContextBlock,
  ContextProvider,
} from "@kernel/types/agent-run.types.js";
import type { SearchConfig, SearchProviderName } from "@nextclaw/core";

function readSearchApiKey(
  searchConfig: SearchConfig | undefined,
  provider: SearchProviderName,
): string {
  return searchConfig?.providers?.[provider]?.apiKey?.trim() ?? "";
}

function renderWebSearchReadiness(params: {
  searchConfig: SearchConfig | undefined;
  toolNames: readonly string[];
}): string {
  const { searchConfig, toolNames } = params;
  if (!toolNames.includes("web_search")) {
    return "web_search is unavailable in this turn.";
  }
  const provider = searchConfig?.provider ?? "bocha";
  const enabledProviders = searchConfig?.enabledProviders ?? ["bocha"];
  if (!enabledProviders.includes(provider)) {
    return `web_search is not ready: provider ${provider} is not enabled.`;
  }
  if (!readSearchApiKey(searchConfig, provider)) {
    return `web_search is not ready: provider ${provider} has no API key configured.`;
  }
  return `web_search is ready with provider ${provider}.`;
}

function renderDelegationGuidance(toolNames: readonly string[]): string {
  return toolNames.includes("sessions_spawn")
    ? "If a task is more complex or takes longer, spawn a sub-agent. Completion is push-based: it will auto-announce when done."
    : "Sub-agent spawning is unavailable in this delegated session. Complete the assigned task directly and return any further delegation needs to the parent session.";
}

export class ToolingContextProvider implements ContextProvider {
  constructor(private readonly context: ContextProviderRunContextService) {}

  provide = async (
    request: AgentRunRequest,
  ): Promise<readonly ContextBlock[]> => {
    const { runContext, toolCatalog } = await this.context.resolve(request);

    return [
      [
        "## Tooling",
        "The provider tool schemas are the complete policy-filtered tool catalog for this turn. Tool names are case-sensitive; call them exactly as defined there.",
        "Web access policy:",
        `- ${renderWebSearchReadiness({
          searchConfig: runContext.profile.searchConfig,
          toolNames: toolCatalog.map((tool) => tool.name),
        })}`,
        "- web_search and Agent Browser are distinct capabilities: web_search is for open-ended source discovery; Agent Browser operates real browser pages.",
        "- In this policy, Agent Browser means the external agent-browser CLI documented by the builtin skill. web_fetch, Chrome/Edge DevTools MCP, and Browser Connector are separate capabilities and must not be called Agent Browser.",
        "- Prefer a ready web_search for open-ended discovery. If it is unavailable, not configured, or returns an error, and browser navigation can still make progress, briefly tell the user you are switching to browser automation, then read and follow the builtin agent-browser skill.",
        "- Do not describe Agent Browser output as web_search output, and do not silently install its external CLI.",
        "TOOLS.md does not control tool availability; it is user guidance for how to use external tools.",
        "For long waits, avoid rapid poll loops: use exec with enough yieldMs.",
        "For relative time/date scheduling requests (for example 'in 5 minutes' / '1分钟后'), first check the current local time with an available tool such as exec/date, then convert it to an absolute ISO time with timezone. Do not guess.",
        renderDelegationGuidance(toolCatalog.map((tool) => tool.name)),
        "Do not poll `subagents list` / `sessions_list` in a loop; only check status on-demand (for intervention, debugging, or when explicitly asked).",
      ].join("\n"),
    ];
  };
}
