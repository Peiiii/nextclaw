import type { Tool } from "./base.js";

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  getDefinitions(): Array<Record<string, unknown>> {
    return Array.from(this.tools.values()).map((tool) => tool.toSchema());
  }

  async execute(name: string, params: Record<string, unknown>): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) {
      return `Error: Tool '${name}' not found`;
    }
    try {
      const errors = tool.validateParams(params);
      if (errors.length) {
        return `Error: Invalid parameters for tool '${name}': ${errors.join("; ")}`;
      }
      return await tool.execute(params);
    } catch (err) {
      return `Error executing ${name}: ${String(err)}`;
    }
  }

  get toolNames(): string[] {
    return Array.from(this.tools.keys());
  }
}
