import type { NcpTool } from "@nextclaw/ncp";
import { STRUCTURED_RESULT_TOOL_NAME } from "./structured-result.tools.js";

export const TOOL_SCHEMA_NAME = "tool_schema";
const EAGER_TOOL_NAMES = new Set([
  TOOL_SCHEMA_NAME, STRUCTURED_RESULT_TOOL_NAME, "node_repl",
  "read_file", "write_file", "edit_file", "list_dir", "exec", "web_search", "web_fetch", "view_image",
]);

/** Model-facing disclosure only; execution continues to validate the original schema. */
export function selectToolModelParameters(tool: NcpTool): NcpTool["parameters"] {
  return EAGER_TOOL_NAMES.has(tool.name) || !tool.parameters || JSON.stringify(tool.parameters).length <= 160
    ? tool.parameters : { type: "object" };
}

export class ToolSchemaTool implements NcpTool {
  readonly name = TOOL_SCHEMA_NAME;
  readonly description = "Read full parameters for an available tool. Before first using a tool whose object schema has no properties field, query its exact name here, then call the original tool with the returned parameter shape.";
  readonly parameters = {
    type: "object",
    properties: { name: { type: "string", minLength: 1 } },
    required: ["name"],
    additionalProperties: false,
  };

  constructor(private readonly readTools: () => readonly NcpTool[]) {}

  execute = async (args: unknown): Promise<unknown> => {
    const name = args && typeof args === "object" && "name" in args ? args.name : null;
    if (typeof name !== "string" || !name.trim()) throw new Error("Tool name is required.");
    const tool = this.readTools().find((candidate) => candidate.name === name.trim());
    if (!tool) throw new Error(`Tool is not in the current allowed catalog: ${name}`);
    return structuredClone({ name: tool.name, description: tool.description, parameters: tool.parameters });
  };
}
