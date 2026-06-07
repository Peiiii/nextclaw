import type { NcpMessage } from "@nextclaw/ncp";
import { buildContextCompactionModelInput } from "@kernel/features/context-compaction/index.js";

export type AgentRunMessageProjectParams = {
  sessionId: string;
  messages: readonly NcpMessage[];
};

export class AgentRunMessageProjector {
  project = (params: AgentRunMessageProjectParams): NcpMessage[] =>
    buildContextCompactionModelInput({
      sessionId: params.sessionId,
      sessionMessages: params.messages,
    });
}
