import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentSessionEventRecord } from "@nextclaw/ncp-toolkit";
import {
  createNcpAgentSessionJournalMetadataEntry,
  isRecord,
  normalizeNcpAgentId,
  safeNcpSessionFilename,
  toIsoString,
} from "@kernel/utils/ncp-agent-session-journal.utils.js";

export type NcpAgentSessionActivitySnapshot = {
  metadata: Record<string, unknown>;
  agentId?: string;
  createdAt: string;
  updatedAt: string;
};

export class NcpAgentSessionMetadataStore {
  constructor(private readonly journalDir: string) {}

  write = async (record: AgentSessionEventRecord): Promise<void> => {
    await mkdir(this.journalDir, { recursive: true });
    const targetPath = this.metadataPath(record.sessionId);
    const tempPath = `${targetPath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await writeFile(tempPath, `${JSON.stringify(createNcpAgentSessionJournalMetadataEntry(record))}\n`, "utf-8");
      await rename(tempPath, targetPath);
    } catch (error) {
      await rm(tempPath, { force: true });
      throw error;
    }
  };

  read = async (
    sessionId: string,
    activitySnapshot: NcpAgentSessionActivitySnapshot,
  ): Promise<NcpAgentSessionActivitySnapshot> => {
    try {
      const parsed = JSON.parse(await readFile(this.metadataPath(sessionId), "utf-8")) as unknown;
      if (!isRecord(parsed) || parsed._type !== "metadata" || !isRecord(parsed.metadata)) {
        throw new Error(`invalid ncp agent session metadata sidecar: ${sessionId}`);
      }
      const createdAt = toIsoString(parsed.created_at, activitySnapshot.createdAt);
      const agentId = normalizeNcpAgentId(typeof parsed.agent_id === "string" ? parsed.agent_id : undefined);
      return {
        metadata: structuredClone(parsed.metadata),
        ...(agentId ? { agentId } : {}),
        createdAt,
        updatedAt: activitySnapshot.updatedAt,
      };
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
      if (code === "ENOENT") {
        return activitySnapshot;
      }
      throw error;
    }
  };

  delete = async (sessionId: string): Promise<void> => {
    await rm(this.metadataPath(sessionId), { force: true });
  };

  private metadataPath = (sessionId: string): string => {
    return join(this.journalDir, `${safeNcpSessionFilename(sessionId.replace(/:/g, "_"))}.metadata.json`);
  };
}
