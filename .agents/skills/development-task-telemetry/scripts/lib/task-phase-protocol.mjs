export const PROTOCOL = "nextclaw.dev/v1";
export const PHASES = [
  "task-understanding",
  "design",
  "implementation",
  "validation",
  "review",
  "delivery",
  "retrospective",
];
export const STATUSES = ["completed", "blocked", "cancelled", "failed"];
export const USAGE_KEYS = [
  "input_tokens",
  "cached_input_tokens",
  "cache_write_input_tokens",
  "output_tokens",
  "reasoning_output_tokens",
  "total_tokens",
];

const TASK_ID_PATTERN = "[a-z0-9][a-z0-9_-]{5,31}";
const TASK_NAME_PATTERN = '[^"\\r\\n\\]]{1,64}';
const PHASE_PATTERN = PHASES.join("|");
const STATUS_PATTERN = STATUSES.join("|");

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const START = new RegExp(
  `^\\[${escapeRegExp(PROTOCOL)} task=start id=(${TASK_ID_PATTERN})(?: name="(${TASK_NAME_PATTERN})")? phase=(${PHASE_PATTERN})\\]$`,
);
const JOIN = new RegExp(
  `^\\[${escapeRegExp(PROTOCOL)} task=join id=(${TASK_ID_PATTERN}) phase=(${PHASE_PATTERN})\\]$`,
);
const PHASE = new RegExp(
  `^\\[${escapeRegExp(PROTOCOL)} phase=(${PHASE_PATTERN})\\]$`,
);
const LEAVE_OR_END = new RegExp(
  `^\\[${escapeRegExp(PROTOCOL)} task=(leave|end) id=(${TASK_ID_PATTERN}) status=(${STATUS_PATTERN})\\]$`,
);

export function extractAssistantText(payload) {
  if (payload?.type !== "message" || payload.role !== "assistant") return null;
  const parts = [];
  for (const content of payload.content ?? []) {
    if (
      content &&
      (content.type === "output_text" || content.type === "text") &&
      typeof content.text === "string"
    ) {
      parts.push(content.text);
    }
  }
  return parts.length > 0 ? parts.join("") : null;
}

function parseMarkerFromText(text) {
  const firstLine = text.split(/\r?\n/, 1)[0];
  const namespace = `[${PROTOCOL}`;
  const occurrences = firstLine.split(namespace).length - 1;
  if (occurrences === 0) return { kind: "none" };
  if (occurrences > 1) return { kind: "invalid", code: "multiple_markers" };

  const markerStart = firstLine.indexOf(namespace);
  const prefix = firstLine.slice(0, markerStart);
  if (!/^(?:\[[^\]\r\n]+\])*$/.test(prefix)) {
    return { kind: "invalid", code: "invalid_marker_position" };
  }

  const markerEnd = firstLine.indexOf("]", markerStart);
  if (markerEnd === -1) return { kind: "invalid", code: "invalid_marker" };
  const raw = firstLine.slice(markerStart, markerEnd + 1);
  const suffix = firstLine.slice(markerEnd + 1);
  if (suffix.length > 0 && !/^\s/.test(suffix)) {
    return { kind: "invalid", code: "invalid_marker_position" };
  }

  let match = raw.match(START);
  if (match) {
    return {
      kind: "marker",
      action: "start",
      taskId: match[1],
      taskName: match[2] ?? null,
      phase: match[3],
      raw,
    };
  }

  match = raw.match(JOIN);
  if (match) {
    return {
      kind: "marker",
      action: "join",
      taskId: match[1],
      phase: match[2],
      raw,
    };
  }

  match = raw.match(PHASE);
  if (match) return { kind: "marker", action: "phase", phase: match[1], raw };

  match = raw.match(LEAVE_OR_END);
  if (match) {
    return {
      kind: "marker",
      action: match[1],
      taskId: match[2],
      status: match[3],
      raw,
    };
  }

  return { kind: "invalid", code: "invalid_marker" };
}

export function parseFrameMarker(assistantTexts) {
  const parsed = assistantTexts
    .map(parseMarkerFromText)
    .filter((result) => result.kind !== "none");
  if (parsed.length === 0) return { kind: "none" };
  if (parsed.length > 1) return { kind: "invalid", code: "multiple_markers" };
  return parsed[0];
}
