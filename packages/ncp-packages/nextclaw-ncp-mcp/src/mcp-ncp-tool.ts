import type { NcpTool, NcpToolExecutionContext } from "@nextclaw/ncp";
import type { McpToolCatalogEntry } from "@nextclaw/mcp";

export class McpNcpTool implements NcpTool {
  readonly name: string;
  readonly description?: string;
  readonly parameters?: Record<string, unknown>;

  constructor(
    private readonly entry: McpToolCatalogEntry,
    private readonly executeImpl: (
      entry: McpToolCatalogEntry,
      args: Record<string, unknown>,
      options: { signal?: AbortSignal },
    ) => Promise<unknown>,
  ) {
    this.name = entry.qualifiedName;
    this.description = entry.description;
    this.parameters = entry.parameters;
  }

  async execute(args: unknown, context?: NcpToolExecutionContext): Promise<unknown> {
    return this.executeImpl(this.entry, isRecord(args) ? args : {}, {
      signal: context?.abortSignal,
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
