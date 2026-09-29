import { NcpEventType, type NcpEndpointEvent } from "@nextclaw/ncp";

export const SESSION_JOURNAL_DELTA_MAX_BYTES = 16 * 1024;
export const SESSION_JOURNAL_DELTA_MAX_AGE_MS = 100;

type DeltaEvent = Extract<NcpEndpointEvent, {
  type: NcpEventType.MessageTextDelta | NcpEventType.MessageReasoningDelta | NcpEventType.MessageToolCallArgsDelta;
}>;

export function isSessionJournalDelta(event: NcpEndpointEvent): event is DeltaEvent {
  return event.type === NcpEventType.MessageTextDelta ||
    event.type === NcpEventType.MessageReasoningDelta ||
    event.type === NcpEventType.MessageToolCallArgsDelta;
}

export function canCoalesceSessionJournalDeltas(left: NcpEndpointEvent, right: NcpEndpointEvent): boolean {
  if (!isSessionJournalDelta(left) || !isSessionJournalDelta(right) || left.type !== right.type) return false;
  const { delta: _leftDelta, ...leftPayload } = left.payload;
  const { delta: _rightDelta, ...rightPayload } = right.payload;
  return JSON.stringify(leftPayload) === JSON.stringify(rightPayload);
}

export function coalesceSessionJournalDeltas(left: DeltaEvent, right: DeltaEvent): DeltaEvent {
  return {
    ...left,
    payload: { ...left.payload, delta: left.payload.delta + right.payload.delta },
  } as DeltaEvent;
}
