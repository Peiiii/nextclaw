import type { AgentRunRequest, ToolProvider } from "@kernel/types/agent-run.types.js";
import {
  STRUCTURED_RESULT_TOOL_NAME,
  StructuredResultSubmitTool,
  type StructuredResultContract,
} from "@kernel/tools/structured-result.tools.js";
import type { NcpTool } from "@nextclaw/ncp";

type StructuredResultMetadata = {
  request_id?: unknown;
  schema?: unknown;
  tool_name?: unknown;
};

export class StructuredResultToolProvider implements ToolProvider {
  provide = (request: AgentRunRequest): readonly NcpTool[] => {
    const contract = readStructuredResultContract(request.message.metadata);
    return contract ? [new StructuredResultSubmitTool(contract)] : [];
  };
}

function readStructuredResultContract(
  metadata: Record<string, unknown> | undefined,
): StructuredResultContract | null {
  const value = metadata?.structured_result;
  if (!isRecord(value)) {
    return null;
  }
  const candidate = value as StructuredResultMetadata;
  if (
    candidate.tool_name !== STRUCTURED_RESULT_TOOL_NAME ||
    typeof candidate.request_id !== "string" ||
    !isRecord(candidate.schema)
  ) {
    return null;
  }
  return {
    requestId: candidate.request_id,
    schema: candidate.schema,
    toolName: STRUCTURED_RESULT_TOOL_NAME,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
