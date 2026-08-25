import {
  NCP_RUN_TRIGGER_METADATA_KEY,
  type NcpEndpointEvent,
  type NcpRunTriggerInput,
  type NcpRunTriggerMetadata,
  type NcpRunTriggerContextValue,
  NcpEventType,
} from "@nextclaw/ncp";
import type {
  AgentRunRequest,
  AgentRunSpec,
} from "@kernel/types/agent-run.types.js";
import { AGENT_RUN_MESSAGE_RUN_SPEC_METADATA_KEY } from "@kernel/utils/agent-run-metadata.utils.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readSourceRunSpec(message: AgentRunRequest["message"]): Record<string, unknown> {
  const value = message.metadata?.[AGENT_RUN_MESSAGE_RUN_SPEC_METADATA_KEY];
  return isRecord(value) ? value : {};
}

const SOURCE_CONTEXT_KEYS = [
  "channel",
  "chatId",
  "accountId",
  "senderId",
  "sessionKey",
  "cron_job_id",
  "cron_job_name",
  "session_origin",
  "observation_delivery_id",
  "observation_subscription_id",
] as const;

function readSourceContext(
  request: AgentRunRequest,
): Record<string, NcpRunTriggerContextValue> | undefined {
  const candidates: Record<string, unknown> = {
    ...(request.metadata ?? {}),
    ...(request.message.metadata ?? {}),
    ...(request.peerId ? { peerId: request.peerId } : {}),
  };
  const entries = [...SOURCE_CONTEXT_KEYS, "peerId"].flatMap((key) => {
    const value = candidates[key];
    return value === null ||
      typeof value === "string" ||
      (typeof value === "number" && Number.isFinite(value)) ||
      typeof value === "boolean"
      ? [[key, value] as const]
      : [];
  });
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function createAgentToolRunTriggerInput(params: {
  request: AgentRunRequest;
  source: string;
}): NcpRunTriggerInput {
  const { request, source } = params;
  const runSpec = readSourceRunSpec(request.message);
  const sourceSessionId = readOptionalString(request.sessionId);
  const sourceRunId = readOptionalString(runSpec.runId);
  const sourceModel = readOptionalString(runSpec.model);
  const sourceContext = readSourceContext(request);
  return {
    actor: "agent",
    source,
    triggeredAt: new Date().toISOString(),
    ...(sourceSessionId ? { sourceSessionId } : {}),
    sourceMessageId: request.message.id,
    ...(sourceRunId ? { sourceRunId } : {}),
    ...(sourceModel ? { sourceModel } : {}),
    ...(sourceContext ? { sourceContext } : {}),
  };
}

export function createIngressRunTriggerInput(params: {
  request: AgentRunRequest;
  source: string;
}): NcpRunTriggerInput {
  const { request } = params;
  const source = request.channel
    ? `channel:${request.channel}`
    : params.source.trim() || "internal";
  const sourceSessionId = readOptionalString(request.sessionId);
  const sourceContext = readSourceContext(request);
  const cronJobId = readOptionalString(request.metadata?.cron_job_id);
  const isCron = request.metadata?.session_origin === "cron" || Boolean(cronJobId);
  return {
    actor: isCron
      ? "automation"
      : request.message.role === "user"
      ? "human"
      : request.message.role === "service"
        ? "automation"
        : "system",
    source: isCron ? (cronJobId ? `cron:${cronJobId}` : "cron") : source,
    triggeredAt: request.message.timestamp,
    ...(sourceSessionId ? { sourceSessionId } : {}),
    sourceMessageId: request.message.id,
    ...(sourceContext ? { sourceContext } : {}),
  };
}

export function resolveRunTriggerMetadata(params: {
  request: AgentRunRequest;
  spec: AgentRunSpec;
  startedAt: string;
}): NcpRunTriggerMetadata {
  const { request, spec, startedAt } = params;
  return resolveTargetRunTriggerMetadata({
    request,
    targetRunId: spec.runId,
    fallbackTriggeredAt: startedAt,
  });
}

export function resolveSteeringRunTriggerMetadata(params: {
  request: AgentRunRequest;
  targetRunId: string;
  acceptedAt: string;
}): NcpRunTriggerMetadata {
  return resolveTargetRunTriggerMetadata({
    request: params.request,
    targetRunId: params.targetRunId,
    fallbackTriggeredAt: params.acceptedAt,
  });
}

function resolveTargetRunTriggerMetadata(params: {
  request: AgentRunRequest;
  targetRunId: string;
  fallbackTriggeredAt: string;
}): NcpRunTriggerMetadata {
  const { request } = params;
  const input = request.trigger ?? createIngressRunTriggerInput({
    request,
    source: "internal",
  });
  const triggeredAt = Number.isFinite(Date.parse(input.triggeredAt))
    ? new Date(input.triggeredAt).toISOString()
    : params.fallbackTriggeredAt;
  return {
    version: 1,
    ...structuredClone(input),
    triggeredAt,
    targetRunId: params.targetRunId,
  };
}

export function createRunTriggerMetadataEvent(params: {
  sessionId: string;
  spec: AgentRunSpec;
  trigger: NcpRunTriggerMetadata;
}): NcpEndpointEvent {
  const { sessionId, spec, trigger } = params;
  return {
    occurredAt: trigger.triggeredAt,
    type: NcpEventType.RunMetadata,
    payload: {
      sessionId,
      runId: spec.runId,
      correlationId: spec.correlationId,
      metadata: {
        [NCP_RUN_TRIGGER_METADATA_KEY]: structuredClone(trigger),
      },
    },
  };
}

export function attachSourceToolCall(
  trigger: NcpRunTriggerInput,
  sourceToolCallId: string | undefined,
): NcpRunTriggerInput {
  const normalizedToolCallId = readOptionalString(sourceToolCallId);
  return {
    ...structuredClone(trigger),
    ...(normalizedToolCallId ? { sourceToolCallId: normalizedToolCallId } : {}),
  };
}
