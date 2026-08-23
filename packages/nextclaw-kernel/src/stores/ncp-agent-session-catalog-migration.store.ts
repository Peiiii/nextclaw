import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { NcpSessionSummary } from "@nextclaw/ncp";
import {
  createNcpAgentSessionSummary,
  type LoadedNcpAgentJournalSession,
  NCP_AGENT_SESSION_JOURNAL_ENTRY_VERSION,
  NCP_AGENT_SESSION_JOURNAL_INDEX_FILE,
  type NcpAgentSessionJournalIndex,
  normalizeNcpSessionId,
} from "@kernel/utils/ncp-agent-session-journal.utils.js";

export type CatalogLegacyScanResult = {
  records: NcpSessionSummary[];
  journalSessionIds: Set<string>;
  diagnostics: Array<{
    sessionId?: string;
    kind: string;
    detail: Record<string, unknown>;
  }>;
};

type JournalScanItem = {
  sessionId: string;
  summary: NcpSessionSummary | null;
  unreadable: boolean;
};

export async function scanNcpAgentSessionCatalogJournals(params: {
  journalDir: string;
  loadSession: (sessionId: string) => Promise<LoadedNcpAgentJournalSession | null>;
  loadSessionSummary?: (sessionId: string) => Promise<NcpSessionSummary | null>;
}): Promise<CatalogLegacyScanResult> {
  const diagnostics: CatalogLegacyScanResult["diagnostics"] = [];
  const legacyRecords = await readLegacyRecords(params.journalDir, diagnostics);
  const records: NcpSessionSummary[] = [];
  const journalSessionIds = new Set<string>();
  let entries: string[];
  try {
    entries = await readdir(params.journalDir);
  } catch (error) {
    diagnostics.push({
      kind: "journal-directory-read-failed",
      detail: { error: error instanceof Error ? error.message : String(error) },
    });
    return { records, journalSessionIds, diagnostics };
  }
  for (const entry of entries) {
    const item = await scanJournalEntry(params, entry, legacyRecords);
    if (!item) continue;
    journalSessionIds.add(item.sessionId);
    if (item.summary) {
      records.push(item.summary);
    } else if (item.unreadable) {
      diagnostics.push({ sessionId: item.sessionId, kind: "journal-unreadable", detail: { file: entry } });
    }
  }
  for (const record of legacyRecords.values()) {
    if (!journalSessionIds.has(record.sessionId)) {
      diagnostics.push({
        sessionId: record.sessionId,
        kind: "legacy-index-orphan",
        detail: { source: NCP_AGENT_SESSION_JOURNAL_INDEX_FILE },
      });
    }
  }
  return { records, journalSessionIds, diagnostics };
}

async function scanJournalEntry(
  params: Parameters<typeof scanNcpAgentSessionCatalogJournals>[0],
  entry: string,
  legacyRecords: Map<string, NcpSessionSummary>,
): Promise<JournalScanItem | null> {
  if (!entry.endsWith(".jsonl")) return null;
  const sessionId = normalizeNcpSessionId(entry.replace(/\.jsonl$/, "").replace(/_/g, ":"));
  const lightweight = params.loadSessionSummary ? await params.loadSessionSummary(sessionId) : null;
  if (lightweight) return { sessionId, summary: lightweight, unreadable: false };
  const loaded = await params.loadSession(sessionId);
  if (loaded) return { sessionId, summary: createNcpAgentSessionSummary(loaded.record), unreadable: false };
  const legacy = legacyRecords.get(sessionId);
  return legacy
    ? { sessionId, summary: structuredClone(legacy), unreadable: false }
    : { sessionId, summary: null, unreadable: true };
}

async function readLegacyRecords(
  journalDir: string,
  diagnostics: CatalogLegacyScanResult["diagnostics"],
): Promise<Map<string, NcpSessionSummary>> {
  try {
    const parsed = JSON.parse(
      await readFile(resolve(journalDir, NCP_AGENT_SESSION_JOURNAL_INDEX_FILE), "utf-8"),
    ) as NcpAgentSessionJournalIndex;
    if (parsed.version === NCP_AGENT_SESSION_JOURNAL_ENTRY_VERSION && Array.isArray(parsed.records)) {
      return new Map(parsed.records.map((record) => [record.sessionId, structuredClone(record)]));
    }
    diagnostics.push({ kind: "legacy-index-invalid", detail: { source: NCP_AGENT_SESSION_JOURNAL_INDEX_FILE } });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code !== "ENOENT") {
      diagnostics.push({
        kind: "legacy-index-unreadable",
        detail: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }
  return new Map();
}
