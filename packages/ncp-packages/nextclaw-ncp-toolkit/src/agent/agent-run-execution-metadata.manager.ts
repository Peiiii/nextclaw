import {
  NCP_AI_EXECUTION_METADATA_KEY,
  NCP_RUN_TRIGGER_METADATA_KEY,
  readNcpAiExecutionMetadata,
  readNcpRunTriggerMetadata,
  type NcpAiExecutionMetadata,
  type NcpMessage,
  type NcpRunTriggerMetadata,
  type NcpRunMetadataPayload,
} from "@nextclaw/ncp";

type AgentRunSettlementMetadata = {
  execution: NcpAiExecutionMetadata | null;
  trigger: NcpRunTriggerMetadata | null;
};

export class AgentRunExecutionMetadataManager {
  private execution: NcpAiExecutionMetadata | null = null;
  private trigger: NcpRunTriggerMetadata | null = null;

  get isEmpty(): boolean {
    return !this.execution && !this.trigger;
  }

  clear = (): void => {
    this.execution = null;
    this.trigger = null;
  };

  beginRun = (runId: string | null | undefined): void => {
    this.execution = null;
    if (!this.trigger || !runId?.trim() || this.trigger.targetRunId !== runId) {
      this.trigger = null;
    }
  };

  observe = (payload: NcpRunMetadataPayload): void => {
    const execution = readNcpAiExecutionMetadata(payload.metadata);
    if (execution && (!payload.runId || payload.runId === execution.runId)) {
      this.execution = structuredClone(execution);
    }
    const trigger = readNcpRunTriggerMetadata(payload.metadata);
    if (trigger && (!payload.runId || payload.runId === trigger.targetRunId)) {
      this.trigger = structuredClone(trigger);
    }
  };

  take = (runId: string | null | undefined): AgentRunSettlementMetadata => {
    const execution = this.execution;
    const trigger = this.trigger;
    this.execution = null;
    this.trigger = null;
    return {
      execution: execution && (!runId?.trim() || execution.runId === runId)
        ? execution
        : null,
      trigger: trigger && (!runId?.trim() || trigger.targetRunId === runId)
        ? trigger
        : null,
    };
  };

  attach = (
    message: NcpMessage,
    metadata: AgentRunSettlementMetadata,
  ): NcpMessage => {
    const { execution, trigger } = metadata;
    if (!execution && !trigger) return message;
    return {
      ...message,
      metadata: {
        ...(message.metadata ?? {}),
        ...(execution
          ? { [NCP_AI_EXECUTION_METADATA_KEY]: structuredClone(execution) }
          : {}),
        ...(trigger
          ? { [NCP_RUN_TRIGGER_METADATA_KEY]: structuredClone(trigger) }
          : {}),
      },
    };
  };
}
