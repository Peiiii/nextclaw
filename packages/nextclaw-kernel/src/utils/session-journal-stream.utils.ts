import { Readable } from "node:stream";
import streamJson from "stream-json";

export type SessionJsonToken = { name: string; value?: string };
type Frame = { value: Record<string, unknown> | unknown[]; path: string[]; index: number; key: string };

/** Maintenance reader: tokenized strings and bounded event skeletons, including a giant single line. */
export async function scanBoundedSessionJournal(params: {
  path?: string; input?: AsyncIterable<string | Uint8Array>; startOffset?: number; endOffset: number; signal?: AbortSignal;
  onToken?: (token: SessionJsonToken, path: readonly string[], entryIndex: number) => void;
  onEntry: (entry: Record<string, unknown>, boundary: number, index: number, truncated: boolean) => Promise<void>;
  onProgress?: (bytes: number) => void;
}): Promise<void> {
  const start = params.startOffset ?? 0;
  if (start >= params.endOffset) return;
  const input = params.input ? Readable.from(params.input, { objectMode: false, highWaterMark: 16 * 1024, signal: params.signal })
    : (await import("node:fs")).createReadStream(params.path!, { start, end: params.endOffset - 1, highWaterMark: 16 * 1024, signal: params.signal });
  const tokens = streamJson.parser({ jsonStreaming: true, packStrings: false, streamStrings: true,
    packKeys: false, streamKeys: true, packNumbers: true, streamNumbers: false });
  const boundaries: number[] = [];
  let readOffset = start;
  let nonWhitespace = false;
  input.on("data", (data: Buffer | string) => {
    const chunk = typeof data === "string" ? Buffer.from(data) : data;
    for (let index = 0; index < chunk.length; index += 1) {
      const byte = chunk[index];
      if (byte === 10) { if (nonWhitespace) boundaries.push(readOffset + index + 1); nonWhitespace = false; }
      else if (byte !== 13 && byte !== 32 && byte !== 9) nonWhitespace = true;
    }
    readOffset += chunk.length;
  });
  input.on("error", (error: Error) => tokens.destroy(error));
  input.pipe(tokens);
  const frames: Frame[] = [];
  let root: unknown;
  let string = "";
  let stringPath: string[] = [];
  let key = "";
  let nodes = 0;
  let chars = 0;
  let truncated = false;
  let entryIndex = 0;
  let checkpointAt = performance.now();
  const path = (): string[] => {
    const parent = frames.at(-1);
    return parent ? [...parent.path, Array.isArray(parent.value) ? String(parent.index) : parent.key] : [];
  };
  const attach = (value: unknown): void => {
    const parent = frames.at(-1);
    if (!parent) { root = value; return; }
    nodes += 1;
    const identity = protocolIdentity(path());
    const checkpoint = path().includes("checkpoint");
    if (checkpoint && (nodes > 4_096 || chars > 1024 * 1024)) throw new Error("Checkpoint exceeds the bounded protocol budget.");
    const keep = identity || (nodes <= 4_096 && chars <= (checkpoint ? 1024 * 1024 : 256 * 1024));
    if (Array.isArray(parent.value)) {
      if (keep && parent.index < 1_024) parent.value.push(value);
      else truncated = true;
      parent.index += 1;
    } else {
      if (keep && (identity || parent.index < 256)) Object.defineProperty(parent.value, parent.key, { value, enumerable: true, writable: true, configurable: true });
      else truncated = true;
      parent.index += 1;
    }
  };
  try {
    for await (const item of tokens) {
      params.signal?.throwIfAborted();
      const token = item as SessionJsonToken;
      const tokenPath = token.name.endsWith("Chunk") || token.name === "endString" ? stringPath
        : token.name === "endObject" || token.name === "endArray" ? frames.at(-1)?.path ?? [] : path();
      params.onToken?.(token, tokenPath, entryIndex);
      switch (token.name) {
        case "startKey": key = ""; break;
        case "stringChunk":
          if (frames.at(-1) && stringPath === KEY_PATH) {
            key += token.value ?? "";
            if (key.length > 1_024) throw new Error("Journal key exceeds the supported identity budget.");
          } else {
            const checkpoint = stringPath.includes("checkpoint");
            const limit = checkpoint ? 1024 * 1024 : 2_048;
            const addition = (token.value ?? "").slice(0, Math.max(0, limit - string.length));
            string += addition;
            if (protocolIdentity(stringPath) && string.length + (token.value?.length ?? 0) - addition.length > 1_024) throw new Error("Journal identity exceeds its supported cursor budget.");
            chars += addition.length;
            if (addition.length !== token.value?.length) truncated = true;
            if (checkpoint && addition.length !== token.value?.length) throw new Error("Checkpoint string exceeds the bounded protocol budget.");
          }
          break;
        case "endKey": if (frames.at(-1)) frames.at(-1)!.key = key; chars += key.length; stringPath = []; break;
        case "startString": string = ""; stringPath = tokenPath; break;
        case "endString": attach(string); break;
        case "startObject":
        case "startArray": {
          if (["metadata", "event.payload.message.metadata"].includes(tokenPath.join("."))) { nodes = 0; chars = 0; }
          if (frames.length >= 64) throw new Error("Journal nesting exceeds the supported depth.");
          const value = token.name === "startArray" ? [] : Object.create(null);
          attach(value);
          frames.push({ value, path: tokenPath, index: 0, key: "" });
          break;
        }
        case "numberValue": attach(Number(token.value)); break;
        case "nullValue": attach(null); break;
        case "trueValue": attach(true); break;
        case "falseValue": attach(false); break;
        case "endObject":
        case "endArray":
          frames.pop();
          if (!frames.length) {
            const boundary = boundaries.shift() ?? params.endOffset;
            if (!root || typeof root !== "object" || Array.isArray(root)) throw new Error("Journal entry must be an object.");
            await params.onEntry(root as Record<string, unknown>, boundary, entryIndex++, truncated);
            nodes = 0; chars = 0; truncated = false; root = undefined;
            params.onProgress?.(boundary);
          }
          break;
      }
      if (token.name === "startKey") stringPath = KEY_PATH;
      if (performance.now() - checkpointAt > 8) {
        params.onProgress?.(readOffset);
        await new Promise<void>(resolve => setImmediate(resolve));
        checkpointAt = performance.now();
      }
    }
    if (frames.length) throw new Error("Journal ended inside an incomplete entry.");
  } finally { input.destroy(); tokens.destroy(); }
}

const KEY_PATH: string[] = [];

function protocolIdentity(path: readonly string[]): boolean {
  const key = path.join(".");
  return ["_type", "version", "seq", "agent_id", "created_at", "updated_at", "event", "event.payload", "event.payload.message", "metadata", "event.payload.message.metadata", "event.type",
    "event.payload.sessionId", "event.payload.messageId", "event.payload.runId", "event.payload.toolCallId",
    "event.payload.message.id", "event.payload.message.sessionId", "event.payload.message.role", "event.payload.message.status", "event.payload.message.timestamp"].includes(key);
}
