import { mkdir, mkdtemp, open, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { NcpMessage } from "@nextclaw/ncp";
import type { SessionMessagePage } from "@kernel/types/session.types.js";
import { parseNcpAgentSessionJournal } from "@kernel/utils/ncp-agent-session-journal-entry.utils.js";
import {
  type LoadedNcpAgentJournalSession,
  isRecord,
  replayNcpAgentSessionEvents,
  safeNcpSessionFilename
} from "@kernel/utils/ncp-agent-session-journal.utils.js";
import {
  decodeNcpAgentSessionMessageCursor,
  deduplicateNcpAgentSessionTailMessages,
  encodeNcpAgentSessionMessageCursor,
  MESSAGE_PROJECTION_OFFSET_RECORD_BYTES,
  parseNcpAgentSessionMessageLocation,
  serializeNcpAgentSessionMessage,
  serializeNcpAgentSessionMessageLocation
} from "@kernel/utils/ncp-agent-session-message-projection.utils.js";

const PROJECTION_VERSION = 1;
const PROJECTION_ROOT_DIRECTORY = ".message-projections";

type MessageProjectionMeta = {
  version: typeof PROJECTION_VERSION;
  sessionId: string;
  total: number;
  lastMessageId: string | null;
  projectedJournalOffset: number;
  dataBytes: number;
  contextWindow: Record<string, unknown> | null;
};

type ReadPageParams = {
  sessionId: string;
  limit: number;
  cursor?: string;
  tailMessages?: readonly NcpMessage[];
};

type MessageProjectionSource = {
  loadSession(sessionId: string): Promise<LoadedNcpAgentJournalSession | null>;
};

export class NcpAgentSessionMessageProjectionStore {
  constructor(
    private readonly journalDir: string,
    private readonly source?: MessageProjectionSource
  ) {}

  readMeta = async (sessionId: string): Promise<MessageProjectionMeta | null> => {
    try {
      const parsed = JSON.parse(await readFile(this.metaPath(sessionId), "utf-8")) as Partial<MessageProjectionMeta>;
      if (
        parsed.version !== PROJECTION_VERSION ||
        parsed.sessionId !== sessionId ||
        !Number.isSafeInteger(parsed.total) ||
        !Number.isSafeInteger(parsed.projectedJournalOffset) ||
        !Number.isSafeInteger(parsed.dataBytes) ||
        (parsed.lastMessageId !== null && typeof parsed.lastMessageId !== "string") ||
        (parsed.contextWindow !== null && !isRecord(parsed.contextWindow))
      ) {
        return null;
      }
      const meta = parsed as MessageProjectionMeta;
      const [dataStat, offsetsStat] = await Promise.all([
        stat(this.dataPath(sessionId)),
        stat(this.offsetsPath(sessionId))
      ]);
      if (
        dataStat.size !== meta.dataBytes ||
        offsetsStat.size !== meta.total * MESSAGE_PROJECTION_OFFSET_RECORD_BYTES ||
        meta.total < 0 ||
        meta.projectedJournalOffset < 0 ||
        meta.dataBytes < 0
      ) {
        return null;
      }
      return structuredClone(meta);
    } catch {
      return null;
    }
  };

  rebuild = async (params: {
    sessionId: string;
    messages: readonly NcpMessage[];
    projectedJournalOffset: number;
    contextWindow?: Record<string, unknown> | null;
  }): Promise<void> => {
    const { contextWindow, messages, projectedJournalOffset, sessionId } = params;
    const projectionPath = this.projectionPath(sessionId);
    const projectionRoot = dirname(projectionPath);
    await mkdir(projectionRoot, { recursive: true });
    const temporaryPath = await mkdtemp(join(projectionRoot, ".rebuild-"));
    try {
      const dataFile = await open(join(temporaryPath, "messages.jsonl"), "w");
      let dataBytes = 0;
      try {
        const offsetsFile = await open(join(temporaryPath, "offsets.idx"), "w");
        try {
          for (const message of messages) {
            const serialized = serializeNcpAgentSessionMessage(message);
            await dataFile.write(serialized, 0, serialized.length, dataBytes);
            await offsetsFile.write(
              serializeNcpAgentSessionMessageLocation({
                offset: dataBytes,
                length: serialized.length
              })
            );
            dataBytes += serialized.length;
          }
          await Promise.all([dataFile.sync(), offsetsFile.sync()]);
        } finally {
          await offsetsFile.close();
        }
      } finally {
        await dataFile.close();
      }
      const meta: MessageProjectionMeta = {
        version: PROJECTION_VERSION,
        sessionId,
        total: messages.length,
        lastMessageId: messages.at(-1)?.id ?? null,
        projectedJournalOffset,
        dataBytes,
        contextWindow: contextWindow ? structuredClone(contextWindow) : null
      };
      await writeFile(join(temporaryPath, "meta.json"), `${JSON.stringify(meta)}\n`, "utf-8");
      await rm(projectionPath, { recursive: true, force: true });
      await rename(temporaryPath, projectionPath);
    } catch (error) {
      await rm(temporaryPath, { recursive: true, force: true });
      throw error;
    }
  };

  synchronize = async (params: {
    sessionId: string;
    messages: readonly NcpMessage[];
    projectedJournalOffset: number;
  }): Promise<boolean> => {
    const { messages: sourceMessages, projectedJournalOffset, sessionId } = params;
    const meta = await this.readMeta(sessionId);
    if (!meta) {
      return false;
    }
    const messages = deduplicateNcpAgentSessionTailMessages(sourceMessages);
    const dataFile = await open(this.dataPath(sessionId), "r+");
    const offsetsFile = await open(this.offsetsPath(sessionId), "r+");
    try {
      for (const message of messages) {
        const serialized = serializeNcpAgentSessionMessage(message);
        const location = { offset: meta.dataBytes, length: serialized.length };
        const serializedLocation = Buffer.from(serializeNcpAgentSessionMessageLocation(location), "utf-8");
        await dataFile.write(serialized, 0, serialized.length, meta.dataBytes);
        meta.dataBytes += serialized.length;
        if (message.id === meta.lastMessageId && meta.total > 0) {
          await offsetsFile.write(
            serializedLocation,
            0,
            MESSAGE_PROJECTION_OFFSET_RECORD_BYTES,
            (meta.total - 1) * MESSAGE_PROJECTION_OFFSET_RECORD_BYTES
          );
          continue;
        }
        await offsetsFile.write(
          serializedLocation,
          0,
          MESSAGE_PROJECTION_OFFSET_RECORD_BYTES,
          meta.total * MESSAGE_PROJECTION_OFFSET_RECORD_BYTES
        );
        meta.total += 1;
        meta.lastMessageId = message.id;
      }
      await Promise.all([dataFile.sync(), offsetsFile.sync()]);
    } finally {
      await Promise.all([dataFile.close(), offsetsFile.close()]);
    }
    meta.projectedJournalOffset = projectedJournalOffset;
    await this.writeMeta(meta);
    return true;
  };

  updateContextWindow = async (sessionId: string, contextWindow: Record<string, unknown> | null): Promise<void> => {
    const meta = await this.readMeta(sessionId);
    if (!meta) {
      return;
    }
    meta.contextWindow = contextWindow ? structuredClone(contextWindow) : null;
    await this.writeMeta(meta);
  };

  listPage = async (params: {
    sessionId: string;
    limit: number;
    cursor?: string;
  }): Promise<SessionMessagePage | null> => {
    const { cursor, limit, sessionId } = params;
    let meta = await this.readMeta(sessionId);
    let tailMessages: NcpMessage[] | null = null;
    const journalStat = await stat(this.journalPath(sessionId));
    if (meta && meta.projectedJournalOffset > journalStat.size) {
      meta = null;
    }
    if (!meta) {
      const loaded = await this.source?.loadSession(sessionId);
      if (!loaded) {
        return null;
      }
      tailMessages = await this.readJournalTailMessages(sessionId, loaded.projectedJournalOffset);
      const tailMessageIds = new Set(tailMessages.map((message) => message.id));
      await this.rebuild({
        sessionId,
        messages: loaded.record.messages.filter((message) => !tailMessageIds.has(message.id)),
        projectedJournalOffset: loaded.projectedJournalOffset
      });
      meta = await this.readMeta(sessionId);
    }
    if (!meta) {
      throw new Error(`Failed to build session message projection: ${sessionId}`);
    }
    return await this.readPage({
      sessionId,
      limit,
      cursor,
      tailMessages: tailMessages ?? (await this.readJournalTailMessages(sessionId, meta.projectedJournalOffset))
    });
  };

  readPage = async (params: ReadPageParams): Promise<SessionMessagePage | null> => {
    const { cursor, limit: requestedLimit, sessionId, tailMessages } = params;
    const meta = await this.readMeta(sessionId);
    if (!meta) {
      return null;
    }
    const uniqueTailMessages = deduplicateNcpAgentSessionTailMessages(tailMessages ?? []);
    const tailById = new Map(uniqueTailMessages.map((message) => [message.id, message]));
    const additionalTailMessages = uniqueTailMessages.filter((message) => message.id !== meta.lastMessageId);
    const limit = Number.isFinite(requestedLimit) ? Math.min(200, Math.max(1, Math.trunc(requestedLimit))) : 80;
    const boundary = cursor ? decodeNcpAgentSessionMessageCursor(cursor, meta.total + 1) : meta.total + 1;
    const includeTail = !cursor;
    const stableLimit = includeTail ? Math.max(0, limit - additionalTailMessages.length) : limit;
    const endOrdinal = Math.min(meta.total, boundary - 1);
    const startOrdinal = stableLimit > 0 ? Math.max(1, endOrdinal - stableLimit + 1) : endOrdinal + 1;
    const stableMessages =
      startOrdinal <= endOrdinal ? await this.readMessages(sessionId, startOrdinal, endOrdinal) : [];
    const messages = stableMessages.map((message) => tailById.get(message.id) ?? message);
    if (includeTail) {
      messages.push(...additionalTailMessages);
    }
    const cursorOrdinal = stableMessages.length > 0 ? startOrdinal : meta.total + 1;
    return {
      messages,
      total: meta.total + additionalTailMessages.length,
      pageInfo: {
        startCursor: messages.length > 0 ? encodeNcpAgentSessionMessageCursor(cursorOrdinal) : null,
        hasPreviousPage: cursorOrdinal > 1
      },
      contextWindow: meta.contextWindow ? structuredClone(meta.contextWindow) : null
    };
  };

  readJournalTailMessages = async (sessionId: string, offset: number): Promise<NcpMessage[]> => {
    const file = await open(this.journalPath(sessionId), "r");
    try {
      const fileStat = await file.stat();
      if (offset < 0 || offset > fileStat.size || offset === fileStat.size) {
        return [];
      }
      const buffer = Buffer.alloc(fileStat.size - offset);
      const result = await file.read(buffer, 0, buffer.length, offset);
      const journal = parseNcpAgentSessionJournal(buffer.subarray(0, result.bytesRead).toString("utf-8"));
      return await replayNcpAgentSessionEvents(journal.events);
    } finally {
      await file.close();
    }
  };

  delete = async (sessionId: string): Promise<void> => {
    await rm(this.projectionPath(sessionId), { recursive: true, force: true });
  };

  private readMessages = async (sessionId: string, startOrdinal: number, endOrdinal: number): Promise<NcpMessage[]> => {
    const count = endOrdinal - startOrdinal + 1;
    const indexBuffer = Buffer.alloc(count * MESSAGE_PROJECTION_OFFSET_RECORD_BYTES);
    const offsetsFile = await open(this.offsetsPath(sessionId), "r");
    const dataFile = await open(this.dataPath(sessionId), "r");
    try {
      const indexRead = await offsetsFile.read(
        indexBuffer,
        0,
        indexBuffer.length,
        (startOrdinal - 1) * MESSAGE_PROJECTION_OFFSET_RECORD_BYTES
      );
      if (indexRead.bytesRead !== indexBuffer.length) {
        throw new Error("Session message projection ended before the requested page.");
      }
      const messages: NcpMessage[] = [];
      for (let index = 0; index < count; index += 1) {
        const recordStart = index * MESSAGE_PROJECTION_OFFSET_RECORD_BYTES;
        const location = parseNcpAgentSessionMessageLocation(
          indexBuffer.subarray(recordStart, recordStart + MESSAGE_PROJECTION_OFFSET_RECORD_BYTES).toString("utf-8")
        );
        const messageBuffer = Buffer.alloc(location.length);
        const messageRead = await dataFile.read(messageBuffer, 0, location.length, location.offset);
        if (messageRead.bytesRead !== location.length) {
          throw new Error("Session message projection contains a truncated message.");
        }
        messages.push(JSON.parse(messageBuffer.toString("utf-8")) as NcpMessage);
      }
      return messages;
    } finally {
      await Promise.all([offsetsFile.close(), dataFile.close()]);
    }
  };

  private writeMeta = async (meta: MessageProjectionMeta): Promise<void> => {
    const path = this.metaPath(meta.sessionId);
    const temporaryPath = `${path}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(meta)}\n`, "utf-8");
    await rename(temporaryPath, path);
  };

  private projectionPath = (sessionId: string): string =>
    join(this.journalDir, PROJECTION_ROOT_DIRECTORY, safeNcpSessionFilename(sessionId));

  private journalPath = (sessionId: string): string =>
    join(this.journalDir, `${safeNcpSessionFilename(sessionId)}.jsonl`);

  private metaPath = (sessionId: string): string => join(this.projectionPath(sessionId), "meta.json");
  private dataPath = (sessionId: string): string => join(this.projectionPath(sessionId), "messages.jsonl");
  private offsetsPath = (sessionId: string): string => join(this.projectionPath(sessionId), "offsets.idx");
}
