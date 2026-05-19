import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentSessionEventRecord } from "@nextclaw/ncp-toolkit";
import {
  createNcpAgentSessionJournalMetadataEntry,
  isRecord,
  normalizeNcpAgentId,
  safeNcpSessionFilename,
  toIsoString,
} from "@kernel/utils/ncp-agent-session-journal.utils.js";

export type NcpAgentSessionMetadataSnapshot = {
  metadata: Record<string, unknown>;
  agentId?: string;
  createdAt: string;
  updatedAt: string;
};

export class NcpAgentSessionMetadataStore {
  constructor(private readonly journalDir: string) {}

  write = async (record: AgentSessionEventRecord): Promise<void> => {
    await mkdir(this.journalDir, { recursive: true });
    await writeFile(
      this.metadataPath(record.sessionId),
      `${this.serializeMetadata(record)}\n`,
      "utf-8",
    );
  };

  read = async (
    sessionId: string,
    fallback: NcpAgentSessionMetadataSnapshot,
  ): Promise<NcpAgentSessionMetadataSnapshot> => {
    try {
      const parsed = JSON.parse(await readFile(this.metadataPath(sessionId), "utf-8")) as unknown;
      if (!isRecord(parsed) || parsed._type !== "metadata") {
        return fallback;
      }
      const createdAt = toIsoString(parsed.created_at, fallback.createdAt);
      const agentId = normalizeNcpAgentId(typeof parsed.agent_id === "string" ? parsed.agent_id : undefined);
      return {
        metadata: isRecord(parsed.metadata) ? structuredClone(parsed.metadata) : {},
        ...(agentId ? { agentId } : {}),
        createdAt,
        updatedAt: toIsoString(parsed.updated_at, createdAt),
      };
    } catch {
      return fallback;
    }
  };

  delete = async (sessionId: string): Promise<void> => {
    try {
      await unlink(this.metadataPath(sessionId));
    } catch {
      // Historical journals may not have a metadata sidecar.
    }
  };

  private serializeMetadata = (record: AgentSessionEventRecord): string => {
    const serialized = JSON.stringify(createNcpAgentSessionJournalMetadataEntry(record));
    if (!serialized) {
      throw new Error("ncp agent session metadata serialization produced empty output");
    }
    return serialized;
  };

  private metadataPath = (sessionId: string): string => {
    return join(this.journalDir, `${safeNcpSessionFilename(sessionId.replace(/:/g, "_"))}.metadata.json`);
  };
}
