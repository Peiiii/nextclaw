type RuntimeMessage = Record<string, unknown>;

const SOURCE_FIELDS = ["role", "content", "reasoning_content", "name", "tool_calls", "tool_call_id",
  "timestamp", "ncp_message_id", "ncp_part_start", "ncp_part_end"] as const;
const IDENTITY_FIELDS = new Set(["role", "name", "id", "type", "tool_call_id", "ncp_message_id", "timestamp"]);
const MIN_SOURCE_TEXT_CHARS = 128;

export function truncateSummarySourceString(value: unknown, maxChars: number): unknown {
  if (typeof value !== "string" || value.length <= maxChars) return value;
  const marker = `[${value.length - maxChars} chars omitted]`;
  const kept = Math.max(0, maxChars - marker.length - 2);
  const head = Math.ceil(kept / 2);
  return `${value.slice(0, head).trimEnd()}\n${marker}\n${kept > head ? value.slice(-(kept - head)).trimStart() : ""}`;
}

function sourceMessages(messages: readonly RuntimeMessage[]): RuntimeMessage[] {
  return messages.map((message) => Object.fromEntries(SOURCE_FIELDS
    .filter((field) => message[field] !== undefined)
    .map((field) => [field, message[field]])));
}

function serializeSource(messages: readonly RuntimeMessage[], textChars: number): string {
  const summaries = new Set(messages.filter((message) =>
    (message.role === "system" || message.role === "service") && typeof message.content === "string"
      && message.content.includes("# Compressed Working Context")).map((message) => message.content));
  return JSON.stringify(sourceMessages(messages), (key, value) =>
    IDENTITY_FIELDS.has(key) || summaries.has(value) ? value : truncateSummarySourceString(value, textChars));
}

/** Shrink verbose fields, never discard a message or break the outer JSON. */
export function stringifyCompactionSource(messages: readonly RuntimeMessage[], maxChars: number): string {
  if (messages.length === 0) return "[]";
  const minimal = serializeSource(messages, MIN_SOURCE_TEXT_CHARS);
  if (minimal.length > maxChars) {
    throw new Error("Compaction source identities exceed the input budget; split the source before summarizing.");
  }
  let fitted = minimal;
  let lower = MIN_SOURCE_TEXT_CHARS;
  let upper = maxChars;
  while (lower <= upper) {
    const limit = Math.floor((lower + upper) / 2);
    const candidate = serializeSource(messages, limit);
    if (candidate.length <= maxChars) { fitted = candidate; lower = limit + 1; }
    else upper = limit - 1;
  }
  return fitted;
}

/** Bound identity overhead before fitting text; every source record belongs to one batch. */
export function splitCompactionSource(messages: readonly RuntimeMessage[], maxChars: number): RuntimeMessage[][] {
  const batches: RuntimeMessage[][] = [];
  let batch: RuntimeMessage[] = [];
  let size = 2;
  for (const message of messages) {
    const messageSize = serializeSource([message], MIN_SOURCE_TEXT_CHARS).length;
    if (messageSize > maxChars) throw new Error("A compaction source record exceeds the minimum safe input budget.");
    if (batch.length > 0 && size + messageSize > maxChars) {
      batches.push(batch); batch = []; size = 2;
    }
    batch.push(message); size += messageSize;
  }
  if (batch.length > 0) batches.push(batch);
  return batches.length > 0 ? batches : [[]];
}
