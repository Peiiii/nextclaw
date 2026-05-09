import type {
  NcpTool,
  NcpToolDefinition,
  NcpToolRegistry,
} from "@nextclaw/ncp";

export class DefaultNcpToolRegistry implements NcpToolRegistry {
  private readonly tools = new Map<string, NcpTool>();

  constructor(tools: ReadonlyArray<NcpTool> = []) {
    for (const t of tools) {
      this.tools.set(t.name, t);
    }
  }

  register = (tool: NcpTool): void => {
    this.tools.set(tool.name, tool);
  };

  listTools = (): ReadonlyArray<NcpTool> => {
    return [...this.tools.values()];
  };

  getTool = (name: string): NcpTool | undefined => {
    return this.tools.get(name);
  };

  getToolDefinitions = (): ReadonlyArray<NcpToolDefinition> => {
    return this.listTools().map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  };

  execute = async (
    _toolCallId: string,
    toolName: string,
    args: unknown,
  ): Promise<unknown> => {
    const tool = this.tools.get(toolName);
    return tool ? await tool.execute(args) : undefined;
  };
}
