import type { CollaborationEvent } from "../types/collaboration.types.js";
export function validateEvent(
  value: unknown,
): asserts value is CollaborationEvent {
  if (!value || typeof value !== "object")
    throw new Error("Event must be an object");
  const event = value as CollaborationEvent;
  if (
    event.specversion !== "1.0" ||
    ![event.id, event.source, event.subject, event.type, event.time].every(
      (v) => typeof v === "string" && v.length > 0 && v.length < 2048,
    ) ||
    !Number.isFinite(Date.parse(event.time))
  )
    throw new Error("Invalid CloudEvents identity or time");
  if (
    !event.data ||
    typeof event.data.body !== "string" ||
    event.data.body.length > 100_000 ||
    typeof event.data.resourceId !== "string" ||
    typeof event.data.actor?.account !== "string" ||
    (event.data.invited !== undefined &&
      typeof event.data.invited !== "boolean") ||
    !["message", "context", "closed", "reopened"].includes(event.data.change)
  )
    throw new Error("Invalid collaboration event data");
}
