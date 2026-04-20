import type { ToolId } from "./entity-ids.types.js";

export type ToolRecord = {
  id: ToolId;
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  enabled: boolean;
  metadata: Record<string, unknown>;
};
