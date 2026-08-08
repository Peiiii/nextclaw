import type { NcpMessage } from "@nextclaw/ncp";
import {
  buildContextCompactionModelProjection,
  type ContextCompactionModelProjection,
} from "@kernel/features/context-compaction/index.js";

export type AgentRunMessageProjectParams = {
  sessionId: string;
  messages: readonly NcpMessage[];
};

export class AgentRunMessageProjector {
  project = (params: AgentRunMessageProjectParams): ContextCompactionModelProjection =>
    buildContextCompactionModelProjection({
      sessionId: params.sessionId,
      sessionMessages: params.messages,
    });
}
