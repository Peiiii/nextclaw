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
    return Array.from(this.tools.values())
      .filter((tool) => tool.isAvailable())
      .map((tool) => tool.toSchema());
  }

  execute = async (name: string, params: Record<string, unknown>, toolCallId?: string): Promise<string> => {
    const result = await this.executeRaw(name, params, toolCallId);
    return stringifyToolResult(result);
  };

  executeRaw = async (name: string, params: Record<string, unknown>, toolCallId?: string): Promise<unknown> => {
    const tool = this.tools.get(name);
    if (!tool) {
      return `Error: Tool '${name}' not found`;
    }
    if (!tool.isAvailable()) {
      return `Error: Tool '${name}' not available`;
    }
    try {
      const errors = tool.validateParams(params);
      if (errors.length) {
        return `Error: Invalid parameters for tool '${name}': ${errors.join("; ")}`;
      }
      return await tool.execute(params, toolCallId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[tool-registry] tool "${name}" execution failed`, err);
      return `Error executing ${name}: ${clipForUser(message, 320)}`;
    }
  };

  get toolNames(): string[] {
    return Array.from(this.tools.keys());
  }
}

function clipForUser(input: string, maxChars = 320): string {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

function stringifyToolResult(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value == null) {
    return "";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
