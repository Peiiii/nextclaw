import type { ToolId } from "@kernel/types/entity-ids.types.js";
import type { ToolRecord } from "@kernel/types/tool.types.js";

export class ToolManager {
  listTools = () => {
    throw new Error("ToolManager.listTools is not implemented.");
  };

  getTool = (toolId: ToolId) => {
    void toolId;
    throw new Error("ToolManager.getTool is not implemented.");
  };

  requireTool = (toolId: ToolId) => {
    void toolId;
    throw new Error("ToolManager.requireTool is not implemented.");
  };

  saveTool = (tool: ToolRecord) => {
    void tool;
    throw new Error("ToolManager.saveTool is not implemented.");
  };

  enableTool = (toolId: ToolId) => {
    void toolId;
    throw new Error("ToolManager.enableTool is not implemented.");
  };

  disableTool = (toolId: ToolId) => {
    void toolId;
    throw new Error("ToolManager.disableTool is not implemented.");
  };

  resolveTools = (toolIds: ToolId[]) => {
    void toolIds;
    throw new Error("ToolManager.resolveTools is not implemented.");
  };
}
