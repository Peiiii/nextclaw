import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, open, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { NcpMessage } from "@nextclaw/ncp";
import type { SessionMessagePage } from "@kernel/types/session.types.js";
import { parseNcpAgentSessionJournal } from "@kernel/utils/ncp-agent-session-journal-entry.utils.js";
import {
  type LoadedNcpAgentJournalSession,
  replayNcpAgentSessionEvents,
  safeNcpSessionFilename
} from "@kernel/utils/ncp-agent-session-journal.utils.js";
import {
  decodeNcpAgentSessionMessageCursor,
  deduplicateNcpAgentSessionTailMessages,
  encodeNcpAgentSessionMessageCursor,
  isNcpAgentSessionMessageProjectionMeta,
  MESSAGE_PROJECTION_OFFSET_RECORD_BYTES,
  mergePendingCompactionMessageIds,
  type NcpAgentSessionMessageProjectionMeta,
  NCP_AGENT_SESSION_MESSAGE_PROJECTION_VERSION,
  parseNcpAgentSessionMessageLocation,
  readActiveAssistantMessageId,
  readPendingCompactionMessageIds,
  serializeNcpAgentSessionMessage,
  serializeNcpAgentSessionMessageLocation
} from "@kernel/utils/ncp-agent-session-message-projection.utils.js";

const PROJECTION_ROOT_DIRECTORY = ".message-projections";

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
  private readonly messageOrdinals = new Map<string, Map<string, number>>();

  constructor(
    private readonly journalDir: string,
    private readonly source?: MessageProjectionSource
  ) {}

  readMeta = async (sessionId: string): Promise<NcpAgentSessionMessageProjectionMeta | null> => {
    try {
      const parsed = JSON.parse(await readFile(this.metaPath(sessionId), "utf-8")) as unknown;
      if (!isNcpAgentSessionMessageProjectionMeta(parsed, sessionId)) {
        return null;
      }
      const meta = parsed;
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
    const { contextWindow, messages: sourceMessages, projectedJournalOffset, sessionId } = params;
    const messages = deduplicateNcpAgentSessionTailMessages(sourceMessages);
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
      const meta: NcpAgentSessionMessageProjectionMeta = {
        version: NCP_AGENT_SESSION_MESSAGE_PROJECTION_VERSION,
        sessionId,
        total: messages.length,
        projectedJournalOffset,
        dataBytes,
        contextWindow: contextWindow ? structuredClone(contextWindow) : null,
        activeMessageId: readActiveAssistantMessageId(messages),
        pendingCompactionMessageIds: readPendingCompactionMessageIds(messages),
      };
      await writeFile(join(temporaryPath, "meta.json"), `${JSON.stringify(meta)}\n`, "utf-8");
      await rm(projectionPath, { recursive: true, force: true });
      await rename(temporaryPath, projectionPath);
      this.messageOrdinals.set(
        sessionId,
        new Map(messages.map((message, index) => [message.id, index + 1])),
      );
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
    const pendingCompactionMessageIds = mergePendingCompactionMessageIds(
      meta.pendingCompactionMessageIds,
      messages,
    );
    const messageOrdinals = await this.readMessageOrdinals(sessionId, meta);
    const dataFile = await open(this.dataPath(sessionId), "r+");
    const offsetsFile = await open(this.offsetsPath(sessionId), "r+");
    try {
      for (const message of messages) {
        const serialized = serializeNcpAgentSessionMessage(message);
        const location = { offset: meta.dataBytes, length: serialized.length };
        const serializedLocation = Buffer.from(serializeNcpAgentSessionMessageLocation(location), "utf-8");
        await dataFile.write(serialized, 0, serialized.length, meta.dataBytes);
        meta.dataBytes += serialized.length;
        const ordinal = messageOrdinals.get(message.id);
        if (ordinal) {
          await offsetsFile.write(
            serializedLocation,
            0,
            MESSAGE_PROJECTION_OFFSET_RECORD_BYTES,
            (ordinal - 1) * MESSAGE_PROJECTION_OFFSET_RECORD_BYTES
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
        messageOrdinals.set(message.id, meta.total);
      }
      await Promise.all([dataFile.sync(), offsetsFile.sync()]);
    } finally {
      await Promise.all([dataFile.close(), offsetsFile.close()]);
    }
    meta.projectedJournalOffset = projectedJournalOffset;
    meta.activeMessageId = readActiveAssistantMessageId(messages);
    meta.pendingCompactionMessageIds = [...pendingCompactionMessageIds];
    await this.writeMeta(meta);
    return true;
  };

  synchronizeJournalTail = async (params: {
    sessionId: string;
    journalOffset: number;
  }): Promise<boolean> => {
    const { journalOffset, sessionId } = params;
    const meta = await this.readMeta(sessionId);
    if (!meta) {
      return false;
    }
    const messages = await this.readJournalTailMessages(sessionId, meta);
    return await this.synchronize({
      sessionId,
      messages,
      projectedJournalOffset: journalOffset,
    });
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
    const journalStat = await stat(this.journalPath(sessionId));
    if (meta && meta.projectedJournalOffset > journalStat.size) {
      meta = null;
    }
    if (!meta) {
      const loaded = await this.source?.loadSession(sessionId);
      if (!loaded) {
        return null;
      }
      await this.rebuild({
        sessionId,
        messages: loaded.record.messages,
        projectedJournalOffset: loaded.journalOffset,
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
      tailMessages: await this.readJournalTailMessages(sessionId, meta),
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
    const messageOrdinals = uniqueTailMessages.length > 0 ? await this.readMessageOrdinals(sessionId, meta) : null;
    const additionalTailMessages = messageOrdinals ? uniqueTailMessages.filter((message) => !messageOrdinals.has(message.id)) : [];
    const limit = Number.isFinite(requestedLimit) ? Math.min(200, Math.max(1, Math.trunc(requestedLimit))) : 40;
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

  private readJournalTailMessages = async (
    sessionId: string,
    meta: NcpAgentSessionMessageProjectionMeta,
  ): Promise<NcpMessage[]> => {
    const file = await open(this.journalPath(sessionId), "r");
    try {
      const fileStat = await file.stat();
      const offset = meta.projectedJournalOffset;
      if (offset < 0 || offset > fileStat.size || offset === fileStat.size) {
        return [];
      }
      const buffer = Buffer.alloc(fileStat.size - offset);
      const result = await file.read(buffer, 0, buffer.length, offset);
      const journal = parseNcpAgentSessionJournal(buffer.subarray(0, result.bytesRead).toString("utf-8"));
      const seedMessageIds = new Set(meta.pendingCompactionMessageIds);
      if (meta.activeMessageId) {
        seedMessageIds.add(meta.activeMessageId);
      }
      const seedMessages = (await Promise.all(
        [...seedMessageIds].map((messageId) =>
          this.readMessageById(sessionId, meta, messageId),
        ),
      )).filter((message): message is NcpMessage => Boolean(message));
      return await replayNcpAgentSessionEvents(
        journal.events,
        seedMessages,
        meta.activeMessageId,
      );
    } finally {
      await file.close();
    }
  };

  delete = async (sessionId: string): Promise<void> => {
    this.messageOrdinals.delete(sessionId);
    await rm(this.projectionPath(sessionId), { recursive: true, force: true });
  };

  private readMessageOrdinals = async (
    sessionId: string,
    meta: NcpAgentSessionMessageProjectionMeta,
  ): Promise<Map<string, number>> => {
    const cached = this.messageOrdinals.get(sessionId);
    if (cached) {
      return cached;
    }
    const messages = meta.total > 0 ? await this.readMessages(sessionId, 1, meta.total) : [];
    const ordinals = new Map(messages.map((message, index) => [message.id, index + 1]));
    this.messageOrdinals.set(sessionId, ordinals);
    return ordinals;
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

  private readMessageById = async (
    sessionId: string,
    meta: NcpAgentSessionMessageProjectionMeta,
    messageId: string,
  ): Promise<NcpMessage | null> => {
    const ordinal = (await this.readMessageOrdinals(sessionId, meta)).get(messageId);
    if (!ordinal) {
      return null;
    }
    return (await this.readMessages(sessionId, ordinal, ordinal))[0] ?? null;
  };

  private writeMeta = async (meta: NcpAgentSessionMessageProjectionMeta): Promise<void> => {
    const path = this.metaPath(meta.sessionId);
    const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
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
