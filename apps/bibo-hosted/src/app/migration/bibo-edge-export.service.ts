import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { NcpAgentSessionJournalStore } from "@nextclaw/kernel";
import { NcpEventType } from "@nextclaw/ncp";
import type { BiboFileDetail } from "@nextclaw/bibo-client";
import { BiboSpaceService } from "@/features/bibo-domain";

const MAX_WORKSPACE_TEXT_BYTES = 1_800_000;

async function readOptional(path: string): Promise<string | null> {
  try { return await readFile(path, "utf8"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function readWorkspaceTexts(root: string, indexedPaths: ReadonlySet<string>): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const walk = async (directory: string, prefix = ""): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.name.startsWith(".") || entry.isSymbolicLink()) throw new Error(`Unsupported Bibo workspace entry ${relative}`);
      const path = join(directory, entry.name);
      if (entry.isDirectory()) { await walk(path, relative); continue; }
      if (!entry.isFile()) throw new Error(`Unsupported Bibo workspace entry ${relative}`);
      if (indexedPaths.has(relative)) continue;
      const contents = await readFile(path);
      if (contents.byteLength > MAX_WORKSPACE_TEXT_BYTES || contents.includes(0)) throw new Error(`Bibo workspace entry ${relative} cannot be migrated as text`);
      try { result[relative] = new TextDecoder("utf-8", { fatal: true }).decode(contents); }
      catch { throw new Error(`Bibo workspace entry ${relative} is not UTF-8 text`); }
    }
  };
  await walk(root);
  return result;
}

/** Read-only legacy export. The container snapshot remains the rollback source until cutover. */
export async function exportBiboEdgeState(home: string, space: BiboSpaceService, uiSessionIds: readonly string[]) {
  const journal = new NcpAgentSessionJournalStore(join(home, "sessions", ".ncp-agent-journal"));
  await journal.initialize();
  try {
    const summaries = await journal.listSessionSummaries();
    const sessionIds = [...new Set([...uiSessionIds, ...summaries.map((item) => item.sessionId)])];
    const sessions = await Promise.all(sessionIds.map(async (sessionId) => ({
      sessionId, record: await journal.getSession(sessionId),
    })));
    const spaceState = await space.exportState();
    const files = await Promise.all(spaceState.files.filter((file) => file.kind !== "folder").map(async (file) => {
      const detail = await space.execute("file.get", { id: file.id }) as BiboFileDetail;
      if (typeof detail.content !== "string") throw new Error(`Bibo file ${file.id} has no content`);
      return { id: file.id, content: detail.content };
    }));
    const indexedPaths = new Set(spaceState.files.filter((file) => file.kind !== "folder").map((file) => file.path));
    const workspaceTexts = await readWorkspaceTexts(join(home, "workspace"), indexedPaths);
    const deliveries = await readOptional(join(home, "inbox", "deliveries.json"));
    return { schema: 1 as const, sessions, spaceState, files, workspaceTexts, deliveries };
  } finally { journal.close(); }
}

type BiboEdgeExport = Awaited<ReturnType<typeof exportBiboEdgeState>>;

function workspacePath(home: string, path: string): string {
  if (!path || path.length > 512 || path.includes("\\") || path.includes("\0") || path.startsWith("/") ||
    path.split("/").some((part) => !part || part === "." || part === ".." || part.startsWith("."))) throw new Error("Invalid Bibo workspace path");
  const root = resolve(home, "workspace");
  const full = resolve(root, path);
  if (!full.startsWith(`${root}${sep}`)) throw new Error("Bibo workspace path escaped its root");
  return full;
}

/** Reverse import is used only while the edge owner is locked; the old R2 snapshot remains intact until verified. */
async function restoreJournals(home: string, before: BiboEdgeExport, source: BiboEdgeExport): Promise<void> {
  const journal = new NcpAgentSessionJournalStore(join(home, "sessions", ".ncp-agent-journal"));
  await journal.initialize();
  try {
    for (const { sessionId } of before.sessions) await journal.deleteSession(sessionId);
    for (const { sessionId, record } of source.sessions) {
      if (!record) continue;
      for (const message of record.messages) await journal.appendSessionEvent({ sessionId, event: {
        type: NcpEventType.MessageSent, occurredAt: message.timestamp, payload: { sessionId, message },
      } });
      if (record.messages.length > 0) await journal.setSessionMetadata({ sessionId, metadata: record.metadata ?? {} });
    }
  } finally { journal.close(); }
}

async function restoreWorkspace(home: string, before: BiboEdgeExport, source: BiboEdgeExport): Promise<void> {
  for (const file of before.spaceState.files.filter((item) => item.kind !== "folder")) {
    await rm(workspacePath(home, file.path), { force: true });
  }
  for (const path of Object.keys(before.workspaceTexts)) {
    if (!(path in source.workspaceTexts)) await rm(workspacePath(home, path), { force: true });
  }
  for (const folder of source.spaceState.files.filter((item) => item.kind === "folder").sort((a, b) => a.path.length - b.path.length)) {
    await mkdir(workspacePath(home, folder.path), { recursive: true });
  }
  for (const [path, content] of Object.entries(source.workspaceTexts)) {
    const full = workspacePath(home, path);
    await mkdir(resolve(full, ".."), { recursive: true });
    await writeFile(full, content, "utf8");
  }
  const fileById = new Map(source.spaceState.files.map((file) => [file.id, file]));
  for (const { id, content } of source.files) {
    const file = fileById.get(id);
    if (!file || file.kind === "folder") throw new Error("Bibo edge file index and contents differ");
    const full = workspacePath(home, file.path);
    await mkdir(resolve(full, ".."), { recursive: true });
    await writeFile(full, content, "utf8");
  }
}

async function verifyImported(home: string, space: BiboSpaceService, source: BiboEdgeExport): Promise<void> {
  const actual = await exportBiboEdgeState(home, space, source.sessions.map((item) => item.sessionId));
  const compareSessions = (value: BiboEdgeExport) => value.sessions.map(({ sessionId, record }) => ({ sessionId,
    messages: record?.messages ?? [], metadata: record?.metadata ?? {} })).sort((a, b) => a.sessionId.localeCompare(b.sessionId));
  if (JSON.stringify(compareSessions(actual)) !== JSON.stringify(compareSessions(source)) ||
    JSON.stringify(actual.spaceState) !== JSON.stringify(source.spaceState) ||
    JSON.stringify(actual.files) !== JSON.stringify(source.files) ||
    JSON.stringify(actual.workspaceTexts) !== JSON.stringify(source.workspaceTexts) || actual.deliveries !== source.deliveries) {
    throw new Error("Bibo reverse import verification failed");
  }
}

export async function importBiboEdgeState(home: string, space: BiboSpaceService, source: BiboEdgeExport): Promise<void> {
  if (source.schema !== 1) throw new Error("Unsupported Bibo edge export schema");
  const before = await exportBiboEdgeState(home, space, []);
  await restoreJournals(home, before, source);
  await restoreWorkspace(home, before, source);
  await space.importState(source.spaceState);
  const deliveryPath = join(home, "inbox", "deliveries.json");
  if (source.deliveries === null) await rm(deliveryPath, { force: true });
  else { await mkdir(resolve(deliveryPath, ".."), { recursive: true }); await writeFile(deliveryPath, source.deliveries, "utf8"); }
  await verifyImported(home, space, source);
}
