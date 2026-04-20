import type { ToolRecord } from "@/types/tool.types.js";
import type { ToolId } from "@/types/entity-ids.types.js";

export abstract class ToolManager {
  abstract listTools(): ToolRecord[];
  abstract getTool(toolId: ToolId): ToolRecord | null;
  abstract requireTool(toolId: ToolId): ToolRecord;
  abstract saveTool(tool: ToolRecord): void;
  abstract enableTool(toolId: ToolId): void;
  abstract disableTool(toolId: ToolId): void;
  abstract resolveTools(toolIds: ToolId[]): ToolRecord[];
}
