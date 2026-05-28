import { validateToolArgs } from "@nextclaw/ncp-agent-runtime";
import type { NcpTool } from "@nextclaw/ncp";

export const STRUCTURED_RESULT_TOOL_NAME = "nextclaw_submit_result";

export type StructuredResultContract = {
  requestId: string;
  schema: Record<string, unknown>;
  toolName: typeof STRUCTURED_RESULT_TOOL_NAME;
};

export class StructuredResultSubmitTool implements NcpTool {
  readonly name = STRUCTURED_RESULT_TOOL_NAME;
  readonly description = "Submit the structured object result for this request.";

  constructor(private readonly contract: StructuredResultContract) {}

  get parameters(): Record<string, unknown> {
    return this.contract.schema;
  }

  validateArgs = (args: Record<string, unknown>): string[] =>
    validateToolArgs(args, this.contract.schema);

  execute = async (args: Record<string, unknown>): Promise<unknown> => args;
}
