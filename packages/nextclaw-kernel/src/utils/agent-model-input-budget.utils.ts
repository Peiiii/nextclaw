import { estimateInputTokens } from "@nextclaw/core";
import type { NcpTool, OpenAITool } from "@nextclaw/ncp";
import { buildOpenAiFunctionTool } from "@nextclaw/ncp-agent-runtime";

export function buildContextBlockInputMessages(
  contextBlocks: readonly string[] = [],
): Record<string, unknown>[] {
  const contextContent = contextBlocks
    .map((block) => block.trim())
    .filter(Boolean)
    .join("\n\n");
  return contextContent ? [{ role: "system", content: contextContent }] : [];
}

export function buildProviderTools(tools: readonly NcpTool[]): OpenAITool[] {
  return tools.map((tool): OpenAITool => buildOpenAiFunctionTool({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}

export function estimateToolInputTokens(tools: readonly NcpTool[]): number {
  return estimateInputTokens(buildProviderTools(tools));
}
