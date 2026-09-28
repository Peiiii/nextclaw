import type { NcpMessage } from "@nextclaw/ncp";

export type BiboEdgeSession = {
  version: 1;
  messages: NcpMessage[];
  metadata: Record<string, unknown>;
};

type SessionIndex = { version: 1; messageIds: string[]; metadata: Record<string, unknown> };
const indexKey = (sessionId: string) => `ncpSession:${sessionId}`;
const messageKey = (sessionId: string, messageId: string) => `ncpMessage:${sessionId}:${messageId}`;
const messageChunkKey = (sessionId: string, messageId: string, index: number) => `${messageKey(sessionId, messageId)}:${index}`;
const MAX_VALUE_BYTES = 1_800_000;
const CHUNK_CHARACTERS = 250_000;
const MAX_MESSAGE_BYTES = 32 * 1024 * 1024;
const MAX_CHUNKS = Math.ceil(MAX_MESSAGE_BYTES / CHUNK_CHARACTERS);
type ChunkHeader = { version: 1; chunks: number };

function chunkCount(message: NcpMessage): number {
  const value = JSON.stringify(message);
  const bytes = new TextEncoder().encode(value).byteLength;
  if (bytes > MAX_MESSAGE_BYTES) throw new Error("Bibo NCP message exceeds the storage limit");
  return bytes <= MAX_VALUE_BYTES ? 0 : Math.ceil(value.length / CHUNK_CHARACTERS);
}

async function readChunkedMessage(storage: DurableObjectStorage, sessionId: string, id: string,
  header: ChunkHeader): Promise<NcpMessage> {
  if (header.version !== 1 || !Number.isInteger(header.chunks) || header.chunks < 1 || header.chunks > MAX_CHUNKS) {
    throw new Error("Bibo NCP message chunk header is invalid");
  }
  const parts: string[] = [];
  for (let offset = 0; offset < header.chunks; offset += 100) {
    const keys = Array.from({ length: Math.min(100, header.chunks - offset) }, (_, part) => messageChunkKey(sessionId, id, offset + part));
    const values = await storage.get<string>(keys);
    for (const key of keys) {
      const value = values.get(key);
      if (typeof value !== "string") throw new Error("Bibo NCP message chunk is missing");
      parts.push(value);
    }
  }
  return JSON.parse(parts.join("")) as NcpMessage;
}

/** Stores finalized NCP messages separately so a new turn does not rewrite old history. */
export class BiboEdgeSessionStore {
  constructor(private readonly storage: DurableObjectStorage) {}

  load = async (sessionId: string): Promise<BiboEdgeSession | null> => {
    const index = await this.storage.get<SessionIndex>(indexKey(sessionId));
    if (!index) return null;
    if (index.version !== 1 || !Array.isArray(index.messageIds)) throw new Error("Bibo NCP session index is invalid");
    const messages: NcpMessage[] = [];
    for (let offset = 0; offset < index.messageIds.length; offset += 100) {
      const keys = index.messageIds.slice(offset, offset + 100).map((id) => messageKey(sessionId, id));
      const values = await this.storage.get<NcpMessage | ChunkHeader>(keys);
      for (let position = 0; position < keys.length; position += 1) {
        const key = keys[position]!;
        const message = values.get(key);
        if (!message) throw new Error("Bibo NCP session message is missing");
        messages.push("chunks" in message
          ? await readChunkedMessage(this.storage, sessionId, index.messageIds[offset + position]!, message)
          : message);
      }
    }
    return { version: 1, messages, metadata: index.metadata ?? {} };
  };

  prepareCommit = (sessionId: string, previous: BiboEdgeSession | null, next: BiboEdgeSession): {
    entries: Record<string, unknown>;
    deletes: string[];
  } => {
    const previousById = new Map(previous?.messages.map((message) => [message.id, message]) ?? []);
    const nextIds = next.messages.map((message) => message.id);
    if (new Set(nextIds).size !== nextIds.length) throw new Error("Bibo NCP session has duplicate message IDs");
    const index: SessionIndex = { version: 1, messageIds: nextIds, metadata: next.metadata };
    const entries: Record<string, unknown> = { [indexKey(sessionId)]: index };
    const deletes: string[] = [];
    for (const message of next.messages) {
      const value = JSON.stringify(message);
      if (JSON.stringify(previousById.get(message.id)) === value) continue;
      const count = chunkCount(message);
      const old = previousById.get(message.id);
      const oldCount = old ? chunkCount(old) : 0;
      entries[messageKey(sessionId, message.id)] = count ? { version: 1, chunks: count } : message;
      for (let part = 0; part < count; part += 1) entries[messageChunkKey(sessionId, message.id, part)] = value.slice(part * CHUNK_CHARACTERS, (part + 1) * CHUNK_CHARACTERS);
      for (let part = count; part < oldCount; part += 1) deletes.push(messageChunkKey(sessionId, message.id, part));
    }
    if (new TextEncoder().encode(JSON.stringify(index)).byteLength > MAX_VALUE_BYTES) throw new Error("Bibo NCP session index exceeds the storage limit");
    const nextIdSet = new Set(nextIds);
    for (const message of previous?.messages ?? []) {
      if (nextIdSet.has(message.id)) continue;
      deletes.push(messageKey(sessionId, message.id));
      for (let part = 0; part < chunkCount(message); part += 1) deletes.push(messageChunkKey(sessionId, message.id, part));
    }
    return { entries, deletes };
  };

  prepareDelete = (sessionId: string, previous: BiboEdgeSession | null): string[] => [
    indexKey(sessionId), ...(previous?.messages.flatMap((message) => [messageKey(sessionId, message.id),
      ...Array.from({ length: chunkCount(message) }, (_, index) => messageChunkKey(sessionId, message.id, index))]) ?? []),
  ];
}
