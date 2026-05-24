import type { NcpTool, NcpToolCallResult } from "@nextclaw/ncp";
import type { CollectedToolCall } from "../round-collector.js";
import {
  createInvalidToolArgumentsResult,
  createToolExecutionFailedResult,
  parseToolArgs,
  validateToolArgs,
} from "../runtime.utils.js";

export type ExecuteCollectedToolCallOptions = {
  toolCall: CollectedToolCall;
  tool: NcpTool | undefined;
  execute: (tool: NcpTool | undefined, args: Record<string, unknown>) => Promise<unknown>;
};

export async function executeCollectedToolCall(
  options: ExecuteCollectedToolCallOptions,
): Promise<NcpToolCallResult> {
  const { toolCall, tool } = options;
  const parsedArgs = parseToolArgs(toolCall.args);
  if (!parsedArgs.ok) {
    return {
      toolCallId: toolCall.toolCallId,
      toolName: toolCall.toolName,
      args: null,
      rawArgsText: parsedArgs.rawText,
      result: createInvalidToolArgumentsResult({
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        rawArgumentsText: parsedArgs.rawText,
        issues: parsedArgs.issues,
      }),
    };
  }

  const validationIssues = tool
    ? [
        ...validateToolArgs(parsedArgs.value, tool.parameters),
        ...(tool.validateArgs?.(parsedArgs.value) ?? []),
      ]
    : [];
  if (validationIssues.length > 0) {
    return {
      toolCallId: toolCall.toolCallId,
      toolName: toolCall.toolName,
      args: null,
      rawArgsText: parsedArgs.rawText,
      result: createInvalidToolArgumentsResult({
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        rawArgumentsText: parsedArgs.rawText,
        issues: validationIssues,
      }),
    };
  }

  try {
    return {
      toolCallId: toolCall.toolCallId,
      toolName: toolCall.toolName,
      args: parsedArgs.value,
      rawArgsText: parsedArgs.rawText,
      result: await options.execute(tool, parsedArgs.value),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.toolCallId,
      toolName: toolCall.toolName,
      args: parsedArgs.value,
      rawArgsText: parsedArgs.rawText,
      result: createToolExecutionFailedResult({
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        error,
      }),
    };
  }
}
