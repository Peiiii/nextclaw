import type { NcpToolOutputContentItem } from "../types/message.js";

export type NcpToolDefinition = {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
};

export interface NcpTool {
  readonly name: string;
  readonly description?: string;
  readonly parameters?: Record<string, unknown>;
  validateArgs?(args: Record<string, unknown>): string[];
  execute(args: unknown): Promise<unknown>;
}

export type NcpToolCallResult = {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown> | null;
  rawArgsText: string;
  result: unknown;
  contentItems?: NcpToolOutputContentItem[];
};

export type NcpInvalidToolArgumentsResult = {
  ok: false;
  error: {
    code: "invalid_tool_arguments";
    message: string;
    toolCallId: string;
    toolName: string;
    rawArgumentsText: string;
    issues: string[];
  };
};

export interface NcpToolRegistry {
  listTools(): ReadonlyArray<NcpTool>;
  getTool(name: string): NcpTool | undefined;
  getToolDefinitions(): ReadonlyArray<NcpToolDefinition>;
  execute(toolCallId: string, toolName: string, args: unknown): Promise<unknown>;
}
