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
export const TASK_TYPES = ["feature", "bugfix", "small-change"];
export const FLOWS = ["standard", "trivial", "bugfix"];
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
const TASK_TYPE_PATTERN = TASK_TYPES.join("|");
const FLOW_PATTERN = FLOWS.join("|");

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const START = new RegExp(
  `^\\[${escapeRegExp(PROTOCOL)} task=start id=(${TASK_ID_PATTERN})(?: name="(${TASK_NAME_PATTERN})")?(?: type=(${TASK_TYPE_PATTERN}))? phase=(${PHASE_PATTERN})\\]$`,
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
const VISIBLE_STEP = new RegExp(`\\[step:(${PHASE_PATTERN})\\]`);
const VISIBLE_FLOW = new RegExp(`\\[flow:(${FLOW_PATTERN})\\]`);

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
  const leadingTags = firstLine.match(/^(?:\[[^\]\r\n]+\]\s*)+/)?.[0] ?? "";
  if (/^\[(?:nextclaw\.dev\/v1|step:|flow:)/.test(firstLine.slice(leadingTags.length)))
    return { kind: "invalid", code: "invalid_marker" };
  const machineCount = leadingTags.split(namespace).length - 1;
  const stepCount = leadingTags.split("[step:").length - 1;
  const flowCount = leadingTags.split("[flow:").length - 1;
  if (machineCount + stepCount + flowCount === 0) return { kind: "none" };
  if (machineCount > 1 || stepCount > 1 || flowCount > 1)
    return { kind: "invalid", code: "multiple_markers" };

  const step = leadingTags.match(VISIBLE_STEP)?.[1] ?? null;
  const flow = leadingTags.match(VISIBLE_FLOW)?.[1] ?? null;
  if ((stepCount && !step) || (flowCount && !flow))
    return { kind: "invalid", code: "invalid_marker" };
  const markerStart = leadingTags.indexOf(namespace);
  if (markerStart >= 0 && (
    (step && leadingTags.indexOf("[step:") > markerStart) ||
    (flow && leadingTags.indexOf("[flow:") > markerStart) ||
    (flow && step && leadingTags.indexOf("[flow:") > leadingTags.indexOf("[step:"))
  )) return { kind: "invalid", code: "invalid_marker_position" };

  if (markerStart === -1) {
    if (!step || (flow && leadingTags.indexOf("[flow:") > leadingTags.indexOf("[step:")))
      return { kind: "invalid", code: "invalid_marker" };
    return { kind: "marker", action: "phase", phase: step, flow, raw: `[step:${step}]` };
  }

  const markerEnd = firstLine.indexOf("]", markerStart);
  if (markerEnd === -1) return { kind: "invalid", code: "invalid_marker" };
  const raw = firstLine.slice(markerStart, markerEnd + 1);

  let match = raw.match(START);
  if (match) {
    if ((step && step !== match[4]) || (flow && !step))
      return { kind: "invalid", code: "state_conflict" };
    return {
      kind: "marker",
      action: "start",
      taskId: match[1],
      taskName: match[2] ?? null,
      taskType: match[3] ?? null,
      phase: match[4],
      flow,
      raw,
    };
  }

  match = raw.match(JOIN);
  if (match) {
    if (flow || (step && step !== match[2]))
      return { kind: "invalid", code: "state_conflict" };
    return {
      kind: "marker",
      action: "join",
      taskId: match[1],
      phase: match[2],
      raw,
    };
  }

  match = raw.match(PHASE);
  if (match) {
    if (flow || (step && step !== match[1]))
      return { kind: "invalid", code: "state_conflict" };
    return { kind: "marker", action: "phase", phase: match[1], raw };
  }

  match = raw.match(LEAVE_OR_END);
  if (match) {
    if (flow || step) return { kind: "invalid", code: "state_conflict" };
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
  const invalid = parsed.find((result) => result.kind === "invalid");
  if (invalid) return invalid;
  if (parsed.length === 1) return parsed[0];
  return { kind: "markers", markers: parsed };
}
