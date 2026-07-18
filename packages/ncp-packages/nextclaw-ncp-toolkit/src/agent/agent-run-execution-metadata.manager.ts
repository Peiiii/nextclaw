import {
  NCP_AI_EXECUTION_METADATA_KEY,
  readNcpAiExecutionMetadata,
  type NcpAiExecutionMetadata,
  type NcpMessage,
  type NcpRunMetadataPayload,
} from "@nextclaw/ncp";

export class AgentRunExecutionMetadataManager {
  private execution: NcpAiExecutionMetadata | null = null;

  get isEmpty(): boolean {
    return !this.execution;
  }

  clear = (): void => {
    this.execution = null;
  };

  observe = (payload: NcpRunMetadataPayload): void => {
    const execution = readNcpAiExecutionMetadata(payload.metadata);
    if (execution && (!payload.runId || payload.runId === execution.runId)) {
      this.execution = structuredClone(execution);
    }
  };

  take = (runId: string | null | undefined): NcpAiExecutionMetadata | null => {
    const execution = this.execution;
    this.execution = null;
    if (!execution || (runId?.trim() && execution.runId !== runId)) {
      return null;
    }
    return execution;
  };

  attach = (
    message: NcpMessage,
    execution: NcpAiExecutionMetadata | null,
  ): NcpMessage => {
    if (!execution) return message;
    return {
      ...message,
      metadata: {
        ...(message.metadata ?? {}),
        [NCP_AI_EXECUTION_METADATA_KEY]: structuredClone(execution),
      },
    };
  };
}
