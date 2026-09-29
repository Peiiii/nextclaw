import type { NcpTool } from "@nextclaw/ncp";
import { STRUCTURED_RESULT_TOOL_NAME } from "./structured-result.tools.js";

export const TOOL_SCHEMA_NAME = "tool_schema";
const EAGER_TOOL_NAMES = new Set([
  TOOL_SCHEMA_NAME, STRUCTURED_RESULT_TOOL_NAME, "node_repl",
  "read_file", "write_file", "edit_file", "list_dir", "exec", "web_search", "web_fetch", "view_image",
  "memory_search", "memory_get",
]);

/** Model-facing disclosure only; execution continues to validate the original schema. */
export function selectToolModelParameters(tool: NcpTool): NcpTool["parameters"] {
  const parameters = tool.modelParameters ?? tool.parameters;
  return EAGER_TOOL_NAMES.has(tool.name) || !parameters || JSON.stringify(parameters).length <= 160
    ? parameters : { type: "object" };
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

  readonly modelParameters?: NcpTool["parameters"];
  readonly validateArgs?: (value: Record<string, unknown>) => string[];

  constructor(private readonly readTools: () => readonly NcpTool[], portableValidation = false) {
    if (portableValidation) {
      this.modelParameters = this.parameters;
      this.validateArgs = (value) => [
        ...(typeof value.name === "string" && value.name.length >= 1 ? [] : ["name must be a nonempty string"]),
        ...Object.keys(value).filter((key) => key !== "name").map((key) => `${key} is not allowed`),
      ];
    }
  }

  execute = async (args: unknown): Promise<unknown> => {
    const name = args && typeof args === "object" && "name" in args ? args.name : null;
    if (typeof name !== "string" || !name.trim()) throw new Error("Tool name is required.");
    const tool = this.readTools().find((candidate) => candidate.name === name.trim());
    if (!tool) throw new Error(`Tool is not in the current allowed catalog: ${name}`);
    return structuredClone({ name: tool.name, description: tool.description, parameters: tool.modelParameters ?? tool.parameters });
  };
}

/** Build one run-scoped catalog from host-provided tools, with the same duplicate and schema rules on every host. */
export function composeAgentToolCatalog(
  groups: readonly (readonly NcpTool[])[],
  options: {
    allowedNames?: ReadonlySet<string> | null;
    includeSchemaTool?: boolean;
    portableValidation?: boolean;
    wrapTool?: (tool: NcpTool) => NcpTool;
  } = {},
): NcpTool[] {
  const tools: NcpTool[] = [];
  const seen = new Set<string>();
  const allowed = options.allowedNames ?? null;
  const isAllowed = (name: string) => allowed === null || allowed.has(name);
  if (options.includeSchemaTool !== false && isAllowed(TOOL_SCHEMA_NAME)) {
    const lookup = new ToolSchemaTool(() => tools, options.portableValidation);
    tools.push(options.wrapTool?.(lookup) ?? lookup);
    seen.add(TOOL_SCHEMA_NAME);
  }
  for (const group of groups) {
    for (const tool of group) {
      if (!isAllowed(tool.name)) continue;
      if (seen.has(tool.name)) {
        if (allowed !== null) throw new Error(`Restricted tool catalog has a duplicate name: ${tool.name}`);
        continue;
      }
      seen.add(tool.name);
      tools.push(options.wrapTool?.(tool) ?? tool);
    }
  }
  return tools;
}
