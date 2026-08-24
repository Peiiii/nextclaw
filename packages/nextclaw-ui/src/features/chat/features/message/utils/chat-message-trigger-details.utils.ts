import type { ChatMessageMoreActionsViewModel } from "@nextclaw/agent-chat-ui";
import {
  readNcpAiExecutionMetadata,
  readNcpRunTriggerMetadata,
  type NcpMessage,
  type NcpRunTriggerActor,
} from "@nextclaw/ncp";

export type ChatMessageTriggerDetailsLabels = {
  moreActions: string;
  viewTrigger: string;
  title: string;
  description: string;
  close: string;
  notAvailable: string;
  fields: {
    actor: string;
    source: string;
    triggeredAt: string;
    targetRunId: string;
    sourceSessionId: string;
    sourceMessageId: string;
    sourceRunId: string;
    sourceToolCallId: string;
    sourceRequestId: string;
    sourceModel: string;
    targetModel: string;
    sourceContext: string;
    raw: string;
  };
  actors: Record<NcpRunTriggerActor, string>;
};

export function mergeChatMessageMoreActions(
  ...candidates: Array<ChatMessageMoreActionsViewModel | null | undefined>
): ChatMessageMoreActionsViewModel | undefined {
  const available = candidates.filter(
    (candidate): candidate is ChatMessageMoreActionsViewModel =>
      Boolean(candidate?.items.length),
  );
  if (available.length === 0) return undefined;
  return {
    triggerLabel: available[0]!.triggerLabel,
    items: available.flatMap((candidate) => candidate.items),
  };
}

function readRunSpec(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  const value = metadata?.run_spec;
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readTargetModel(
  metadata: Record<string, unknown> | null | undefined,
): string | undefined {
  const runSpecModel = readRunSpec(metadata)?.model;
  if (typeof runSpecModel === "string" && runSpecModel.trim()) {
    return runSpecModel.trim();
  }
  return readNcpAiExecutionMetadata(metadata)?.model;
}

export function buildChatMessageTriggerDetails(params: {
  labels: ChatMessageTriggerDetailsLabels;
  message: Pick<NcpMessage, "metadata">;
}): ChatMessageMoreActionsViewModel | null {
  const { labels, message } = params;
  const trigger = readNcpRunTriggerMetadata(message.metadata);
  if (!trigger) return null;
  const { fields } = labels;
  const runSpec = readRunSpec(message.metadata);
  const rows = [
    { label: fields.actor, value: labels.actors[trigger.actor] },
    { label: fields.source, value: trigger.source },
    { label: fields.triggeredAt, value: trigger.triggeredAt },
    { label: fields.targetRunId, value: trigger.targetRunId },
    { label: fields.sourceSessionId, value: trigger.sourceSessionId },
    { label: fields.sourceMessageId, value: trigger.sourceMessageId },
    { label: fields.sourceRunId, value: trigger.sourceRunId },
    { label: fields.sourceToolCallId, value: trigger.sourceToolCallId },
    { label: fields.sourceRequestId, value: trigger.sourceRequestId },
    { label: fields.sourceModel, value: trigger.sourceModel },
    { label: fields.targetModel, value: readTargetModel(message.metadata) },
    {
      label: fields.sourceContext,
      value: trigger.sourceContext
        ? JSON.stringify(trigger.sourceContext, null, 2)
        : undefined,
    },
  ].map((row) => ({
    label: row.label,
    value: row.value ?? labels.notAvailable,
  }));
  rows.push({
    label: fields.raw,
    value: JSON.stringify({
      run_trigger: trigger,
      ...(runSpec ? { run_spec: runSpec } : {}),
    }, null, 2),
  });
  return {
    triggerLabel: labels.moreActions,
    items: [{
      key: "run-trigger-metadata",
      label: labels.viewTrigger,
      dialog: {
        title: labels.title,
        description: labels.description,
        closeLabel: labels.close,
        rows,
      },
    }],
  };
}
