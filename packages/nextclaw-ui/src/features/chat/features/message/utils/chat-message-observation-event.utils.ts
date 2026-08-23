import { OBSERVATION_EVENT_EXTENSION_TYPE } from "@nextclaw/ncp";

export const OBSERVATION_EVENT_PART_EXTENSION_TYPE =
  OBSERVATION_EVENT_EXTENSION_TYPE;
const LEGACY_OBSERVATION_EVENT_PART_EXTENSION_TYPE =
  "nextclaw.observation.event";
const PREVIOUS_OBSERVATION_EVENT_PART_EXTENSION_TYPE =
  "ncp.observation.event";

export function isObservationEventPartExtensionType(value: string): boolean {
  return value === OBSERVATION_EVENT_PART_EXTENSION_TYPE ||
    value === PREVIOUS_OBSERVATION_EVENT_PART_EXTENSION_TYPE ||
    value === LEGACY_OBSERVATION_EVENT_PART_EXTENSION_TYPE;
}

export type ObservationEventPartData = {
  deliveryId: string;
  extensionId: string;
  eventId: string;
  eventType: string;
  occurredAt: string;
  payload: unknown;
  sourceRefs?: unknown;
  causationId?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRequiredString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function readObservationEventPartData(
  value: unknown,
): ObservationEventPartData | null {
  if (!isRecord(value)) return null;
  const deliveryId = readRequiredString(value, "deliveryId");
  const extensionId = readRequiredString(value, "extensionId");
  const eventId = readRequiredString(value, "eventId");
  const eventType = readRequiredString(value, "eventType");
  const occurredAt = readRequiredString(value, "occurredAt");
  if (!deliveryId || !extensionId || !eventId || !eventType || !occurredAt) {
    return null;
  }
  return {
    deliveryId,
    extensionId,
    eventId,
    eventType,
    occurredAt,
    payload: value.payload,
    ...(value.sourceRefs !== undefined ? { sourceRefs: value.sourceRefs } : {}),
    ...(typeof value.causationId === "string" && value.causationId.trim()
      ? { causationId: value.causationId.trim() }
      : {}),
  };
}

export function stringifyObservationEventPayload(
  value: unknown,
  maxChars = 6000,
): string {
  let serialized: string;
  if (typeof value === "string") {
    serialized = value;
  } else {
    try {
      serialized = JSON.stringify(value, null, 2) ?? "";
    } catch {
      serialized = String(value);
    }
  }
  if (serialized.length <= maxChars) return serialized;
  return `${serialized.slice(0, Math.max(0, maxChars - 16))}\n…`;
}
