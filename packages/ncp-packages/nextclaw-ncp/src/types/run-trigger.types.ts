export const NCP_RUN_TRIGGER_METADATA_KEY = "run_trigger";

export type NcpRunTriggerActor = "human" | "agent" | "automation" | "system";
export type NcpRunTriggerContextValue = string | number | boolean | null;

export type NcpRunTriggerInput = {
  actor: NcpRunTriggerActor;
  source: string;
  triggeredAt: string;
  sourceSessionId?: string;
  sourceMessageId?: string;
  sourceRunId?: string;
  sourceToolCallId?: string;
  sourceRequestId?: string;
  sourceModel?: string;
  sourceContext?: Record<string, NcpRunTriggerContextValue>;
};

export type NcpRunTriggerMetadata = NcpRunTriggerInput & {
  version: 1;
  targetRunId: string;
};

function readRequiredString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readOptionalString(value: unknown): string | undefined {
  return readRequiredString(value) ?? undefined;
}

function readSourceContext(
  value: unknown,
): Record<string, NcpRunTriggerContextValue> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const entries = Object.entries(value).filter(
    (entry): entry is [string, NcpRunTriggerContextValue] =>
      entry[0].trim().length > 0 &&
      (entry[1] === null ||
        typeof entry[1] === "string" ||
        (typeof entry[1] === "number" && Number.isFinite(entry[1])) ||
        typeof entry[1] === "boolean"),
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function parseNcpRunTriggerInput(raw: unknown): NcpRunTriggerInput | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const actor = value.actor;
  const source = readRequiredString(value.source);
  const triggeredAt = readRequiredString(value.triggeredAt);
  if (
    (actor !== "human" && actor !== "agent" && actor !== "automation" && actor !== "system") ||
    !source ||
    !triggeredAt ||
    !Number.isFinite(Date.parse(triggeredAt))
  ) {
    return null;
  }
  const sourceSessionId = readOptionalString(value.sourceSessionId);
  const sourceMessageId = readOptionalString(value.sourceMessageId);
  const sourceRunId = readOptionalString(value.sourceRunId);
  const sourceToolCallId = readOptionalString(value.sourceToolCallId);
  const sourceRequestId = readOptionalString(value.sourceRequestId);
  const sourceModel = readOptionalString(value.sourceModel);
  const sourceContext = readSourceContext(value.sourceContext);
  return {
    actor,
    source,
    triggeredAt: new Date(triggeredAt).toISOString(),
    ...(sourceSessionId ? { sourceSessionId } : {}),
    ...(sourceMessageId ? { sourceMessageId } : {}),
    ...(sourceRunId ? { sourceRunId } : {}),
    ...(sourceToolCallId ? { sourceToolCallId } : {}),
    ...(sourceRequestId ? { sourceRequestId } : {}),
    ...(sourceModel ? { sourceModel } : {}),
    ...(sourceContext ? { sourceContext } : {}),
  };
}

export function readNcpRunTriggerMetadata(
  metadata: Record<string, unknown> | null | undefined,
): NcpRunTriggerMetadata | null {
  const raw = metadata?.[NCP_RUN_TRIGGER_METADATA_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const input = parseNcpRunTriggerInput(value);
  const targetRunId = readRequiredString(value.targetRunId);
  if (value.version !== 1 || !input || !targetRunId) return null;
  return {
    version: 1,
    ...input,
    targetRunId,
  };
}
