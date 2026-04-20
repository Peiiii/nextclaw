import type { ToolRecord } from "@/types/tool.types.js";
import type { ToolId } from "@/types/entity-ids.types.js";

export class ToolManager {
  readonly listTools = () => {
    // TODO(kernel): return the current tool registry snapshot.
    throw new Error("ToolManager.listTools is not implemented.");
  };

  readonly getTool = (toolId: ToolId) => {
    // TODO(kernel): look up a tool by id.
    void toolId;
    throw new Error("ToolManager.getTool is not implemented.");
  };

  readonly requireTool = (toolId: ToolId) => {
    // TODO(kernel): resolve a tool and throw a domain error when missing.
    void toolId;
    throw new Error("ToolManager.requireTool is not implemented.");
  };

  readonly saveTool = (tool: ToolRecord) => {
    // TODO(kernel): persist tool state.
    void tool;
    throw new Error("ToolManager.saveTool is not implemented.");
  };

  readonly enableTool = (toolId: ToolId) => {
    // TODO(kernel): enable tool availability.
    void toolId;
    throw new Error("ToolManager.enableTool is not implemented.");
  };

  readonly disableTool = (toolId: ToolId) => {
    // TODO(kernel): disable tool availability.
    void toolId;
    throw new Error("ToolManager.disableTool is not implemented.");
  };

  readonly resolveTools = (toolIds: ToolId[]) => {
    // TODO(kernel): resolve the effective tool set for a run.
    void toolIds;
    throw new Error("ToolManager.resolveTools is not implemented.");
  };
}
