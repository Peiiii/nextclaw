import type { NcpMessage, NcpMessagePart, NcpToolOutputContentItem } from "@nextclaw/ncp";
import { MODEL_ROUND_PART_OFFSETS } from "@nextclaw/ncp-agent-runtime";

export const SESSION_BODY_CHUNK_BYTES = 16 * 1024;
export const SESSION_PAGE_BYTES = 256 * 1024;
export const SESSION_RUN_BYTES = 8 * 1024 * 1024;

/** Serialize JSON without allocating another complete copy of a giant string/part. */
export function* sessionJsonFragments(value: unknown, sortedKeys = false): Generator<string> {
  if (typeof value === "string") {
    yield '"';
    for (let start = 0; start < value.length; start += 1_024) {
      yield JSON.stringify(value.slice(start, start + 1_024)).slice(1, -1);
    }
    yield '"';
  } else if (Array.isArray(value)) {
    yield "[";
    for (let index = 0; index < value.length; index += 1) {
      if (index) yield ",";
      yield* sessionJsonFragments(value[index] ?? null, sortedKeys);
    }
    yield "]";
  } else if (value && typeof value === "object") {
    yield "{";
    let first = true;
    const keys = sortedKeys ? Object.keys(value).sort() : (function* () { for (const key in value) yield key; })();
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
      const child = (value as Record<string, unknown>)[key];
      if (child === undefined || typeof child === "function") continue;
      if (!first) yield ",";
      first = false;
      yield* sessionJsonFragments(key);
      yield ":";
      yield* sessionJsonFragments(child, sortedKeys);
    }
    yield "}";
  } else {
    yield JSON.stringify(value) ?? "null";
  }
}

export function* sessionJsonChunks(value: unknown): Generator<string> {
  let chunk = "";
  let bytes = 0;
  for (const fragment of sessionJsonFragments(value)) {
    const size = Buffer.byteLength(fragment);
    if (bytes + size > SESSION_BODY_CHUNK_BYTES && chunk) {
      yield chunk;
      chunk = "";
      bytes = 0;
    }
    chunk += fragment;
    bytes += size;
  }
  if (chunk) yield chunk;
}

export function measureSessionJsonBytes(value: unknown, limit = SESSION_RUN_BYTES): number {
  let bytes = 0;
  for (const fragment of sessionJsonFragments(value)) {
    bytes += Buffer.byteLength(fragment);
    if (bytes > limit) break;
  }
  return bytes;
}

function preview(value: unknown, remaining: { chars: number }, depth = 0): unknown {
  if (remaining.chars <= 0) return "[archived; read source]";
  if (typeof value === "string") {
    const limit = Math.min(2_048, remaining.chars);
    const text = value.slice(0, limit);
    remaining.chars -= text.length;
    return text.length < value.length ? `${text}\n[archived; read source]` : text;
  }
  if (value === null || typeof value !== "object") return value;
  if (depth >= 4) return "[archived; read source]";
  if (Array.isArray(value)) return value.slice(0, 16).map((item) => preview(item, remaining, depth + 1));
  const result: Record<string, unknown> = Object.create(null);
  let count = 0;
  for (const key in value) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    if (count++ >= 24) break;
    result[key.slice(0, 256)] = preview((value as Record<string, unknown>)[key], remaining, depth + 1);
  }
  return result;
}

export function buildSessionValuePreview(value: unknown): unknown {
  return preview(value, { chars: 8_192 });
}

function previewMessagePart(part: NcpMessagePart, budget: { chars: number }): NcpMessagePart {
  if (part.type !== "tool-invocation") return preview(part, budget) as NcpMessagePart;
  // Results take priority over argument previews, so even a huge command cannot hide its small exit/hash result.
  const result = part.result !== undefined ? preview(part.result, budget) : undefined;
  const args = part.args !== undefined ? preview(part.args, budget) : undefined;
  const items = preview(part.resultContentItems, budget);
  // Payload budgets may omit bodies, but must not change the tool protocol's identity or array types.
  const contentItems = Array.isArray(items) ? items.filter(
    (item): item is NcpToolOutputContentItem => item !== null && typeof item === "object"
      && ((item.type === "input_text" && typeof item.text === "string")
        || (item.type === "input_image" && typeof item.imageUrl === "string" && !item.imageUrl.includes("[archived; read source]"))),
  ) : undefined;
  return {
    type: "tool-invocation", toolName: part.toolName, toolCallId: part.toolCallId, state: part.state,
    ...(part.args !== undefined ? { args: part.args && typeof part.args === "object" && typeof args !== "object" ? {} : args ?? {} } : {}),
    ...(part.result !== undefined ? { result } : {}),
    ...(contentItems ? { resultContentItems: contentItems } : {}),
    ...(part.execution ? { execution: part.execution } : {}),
  };
}

/** Descriptors are persisted at ingestion, not made after reading a full stored message. */
export function buildSessionMessageDescriptor(message: NcpMessage, revision: string): NcpMessage {
  // Bound even JSON-escaped surrogate-heavy previews, leaving room for identities and cursors.
  const budget = { chars: 2_048 };
  const parts = message.parts.slice(0, 16).map((part) => previewMessagePart(part, budget));
  const descriptor = {
    id: message.id, sessionId: message.sessionId, role: message.role, status: message.status,
    timestamp: message.timestamp, parts,
    ...(message.lifecycle ? { lifecycle: preview(message.lifecycle, budget) } : {}),
    metadata: {
      ...(preview(message.metadata ?? {}, budget) as Record<string, unknown>),
      nextclaw_source: { messageId: message.id, revision, partCount: message.parts.length },
    },
  } as NcpMessage;
  const offsets = message.metadata?.[MODEL_ROUND_PART_OFFSETS];
  if (Array.isArray(offsets)) descriptor.metadata![MODEL_ROUND_PART_OFFSETS] = offsets.slice(-1_024);
  // Checkpoints are already bounded protocol objects and must never become truncated prose.
  if (message.metadata?.nextclaw_timeline_kind === "context_compaction") {
    descriptor.metadata = { ...message.metadata, nextclaw_source: descriptor.metadata?.nextclaw_source };
  }
  return descriptor;
}
