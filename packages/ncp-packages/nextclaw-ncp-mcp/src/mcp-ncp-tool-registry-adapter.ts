import type { McpRegistryService } from "@nextclaw/mcp";
import { McpNcpTool } from "./mcp-ncp-tool.js";

export class McpNcpToolRegistryAdapter {
  constructor(private readonly registryService: McpRegistryService) {}

  listToolsForRun(context: { agentId: string }): McpNcpTool[] {
    return this.registryService.listAccessibleTools({
      agentId: context.agentId
    }).map((entry) =>
      new McpNcpTool(entry, async (toolEntry, args, options) =>
        this.registryService.callTool({
          serverName: toolEntry.serverName,
          toolName: toolEntry.toolName,
          args,
          signal: options.signal,
        })
      )
    );
  }
}
