import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
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
    const targetPath = this.metadataPath(record.sessionId);
    const tempPath = `${targetPath}.${process.pid}.${randomUUID()}.tmp`;
    let output: Awaited<ReturnType<typeof open>> | undefined;
    let stage = "mkdir";
    try {
      await mkdir(this.journalDir, { recursive: true });
      stage = "open";
      output = await open(tempPath, "wx");
      stage = "serialize";
      const text = `${JSON.stringify(createNcpAgentSessionJournalMetadataEntry(record))}\n`;
      stage = "write";
      await output.writeFile(text, "utf-8");
      stage = "sync";
      await output.sync();
      stage = "close";
      await output.close();
      output = undefined;
      stage = "rename";
      await rename(tempPath, targetPath);
    } catch (error) {
      const failure = await this.cleanupFailedWrite(output, tempPath, error);
      throw Object.assign(failure, { sessionPersistence: { operation: "metadata.write", stage, path: targetPath, metadataCommitted: false } });
    }
  };

  private cleanupFailedWrite = async (output: Awaited<ReturnType<typeof open>> | undefined, tempPath: string, original: unknown): Promise<Error> => {
    const errors: unknown[] = [];
    if (output) {
      try { await output.close(); } catch (error) { errors.push(error); }
    }
    try { await rm(tempPath, { force: true }); } catch (error) { errors.push(error); }
    if (errors.length) return new AggregateError([original, ...errors], "Metadata write and cleanup failed", { cause: original });
    return original instanceof Error ? original : new Error(String(original));
  };

  read = async (
    sessionId: string,
    activitySnapshot: NcpAgentSessionActivitySnapshot,
  ): Promise<NcpAgentSessionActivitySnapshot> => {
    const path = this.metadataPath(sessionId);
    let stage = "read";
    try {
      const text = await readFile(path, "utf-8");
      stage = "parse";
      const parsed = JSON.parse(text) as unknown;
      if (!isRecord(parsed) || parsed._type !== "metadata" || !isRecord(parsed.metadata)) {
        throw new Error(`invalid ncp agent session metadata sidecar: ${sessionId}`);
      }
      const createdAt = toIsoString(parsed.created_at, activitySnapshot.createdAt);
      const sidecarUpdatedAt = toIsoString(parsed.updated_at, activitySnapshot.updatedAt);
      const updatedAt = Date.parse(sidecarUpdatedAt) > Date.parse(activitySnapshot.updatedAt)
        ? sidecarUpdatedAt
        : activitySnapshot.updatedAt;
      const agentId = normalizeNcpAgentId(typeof parsed.agent_id === "string" ? parsed.agent_id : undefined);
      return {
        metadata: structuredClone(parsed.metadata),
        ...(agentId ? { agentId } : {}),
        createdAt,
        updatedAt,
      };
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
      if (code === "ENOENT") {
        return activitySnapshot;
      }
      throw Object.assign(error instanceof Error ? error : new Error(String(error)), {
        sessionPersistence: { operation: "metadata.read", stage, path },
      });
    }
  };

  delete = async (sessionId: string): Promise<void> => {
    await rm(this.metadataPath(sessionId), { force: true });
  };

  private metadataPath = (sessionId: string): string => {
    return join(this.journalDir, `${safeNcpSessionFilename(sessionId.replace(/:/g, "_"))}.metadata.json`);
  };
}
