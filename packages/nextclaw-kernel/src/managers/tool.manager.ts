import type { ToolRecord } from "@/types/tool.types.js";
import type { ToolId } from "@/types/entity-ids.types.js";

export class ToolManager {
  readonly listTools = () => {
    throw new Error("ToolManager.listTools is not implemented.");
  };

  readonly getTool = (toolId: ToolId) => {
    void toolId;
    throw new Error("ToolManager.getTool is not implemented.");
  };

  readonly requireTool = (toolId: ToolId) => {
    void toolId;
    throw new Error("ToolManager.requireTool is not implemented.");
  };

  readonly saveTool = (tool: ToolRecord) => {
    void tool;
    throw new Error("ToolManager.saveTool is not implemented.");
  };

  readonly enableTool = (toolId: ToolId) => {
    void toolId;
    throw new Error("ToolManager.enableTool is not implemented.");
  };

  readonly disableTool = (toolId: ToolId) => {
    void toolId;
    throw new Error("ToolManager.disableTool is not implemented.");
  };

  readonly resolveTools = (toolIds: ToolId[]) => {
    void toolIds;
    throw new Error("ToolManager.resolveTools is not implemented.");
  };
}
