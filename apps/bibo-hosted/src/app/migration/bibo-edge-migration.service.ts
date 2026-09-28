import type { BiboFile } from "@nextclaw/bibo-client";
import type { BiboSpaceState } from "@/features/bibo-domain";
import type { exportBiboEdgeState } from "./bibo-edge-export.service";
import { BiboSpaceStateStore } from "../bibo-space-state.service";
import { BiboSpaceFileStore } from "../stores/bibo-space-file.store";
import { BiboEdgeSessionStore, type BiboEdgeSession } from "../stores/bibo-edge-session.store";
import { applyBiboStorageChanges } from "../utils/bibo-storage.utils";

type LegacyExport = Awaited<ReturnType<typeof exportBiboEdgeState>>;
type UiSession = { id: string; messages: Array<{ role: string; text: string; at?: string }> };
type MigrationEvidence = { sessions: number; messages: number; files: number; workspaceTexts: number };
const workspaceKey = (path: string) => `edgeWorkspace:${path}`;

/** An older runner could save the visible reply after its journal assistant failed. Keep that
 * journal entry, mark it terminal, and add the exact visible reply to the active NCP history. */
function recoverVisibleReply(source: LegacyExport, uiSessions: readonly UiSession[]): LegacyExport {
  const visible = new Map(uiSessions.map((session) => [session.id, session]));
  return { ...source, sessions: source.sessions.map((item) => {
    const ui = visible.get(item.sessionId);
    const record = item.record;
    if (!ui || ui.messages.length !== 2 || !record || record.messages.length !== 2) return item;
    const [uiUser, uiAssistant] = ui.messages;
    const [journalUser, journalAssistant] = record.messages;
    if (uiUser?.role !== "user" || uiAssistant?.role !== "assistant" || !uiAssistant.text ||
      journalUser?.role !== "user" || journalUser.status !== "final" ||
      journalUser.parts.filter((part) => part.type === "text").map((part) => part.text).join("") !== uiUser.text ||
      journalAssistant?.role !== "assistant" || journalAssistant.status === "final") return item;
    const recovered = { id: `bibo-ui-recovered-${item.sessionId}`, sessionId: item.sessionId,
      role: "assistant" as const, status: "final" as const, timestamp: uiAssistant.at ?? journalAssistant.timestamp,
      parts: [{ type: "text" as const, text: uiAssistant.text }] };
    if (record.messages.some((message) => message.id === recovered.id)) return item;
    return { ...item, record: { ...record, messages: [journalUser,
      { ...journalAssistant, status: "error" as const }, recovered] } };
  }) };
}

function validateExport(source: LegacyExport, uiSessions: readonly UiSession[]): void {
  if (source.schema !== 1) throw new Error("Unsupported Bibo export schema");
  const sessionById = new Map(source.sessions.map(({ sessionId, record }) => [sessionId, record]));
  for (const session of uiSessions) {
    const record = sessionById.get(session.id);
    if (!record && session.messages.length > 0) throw new Error(`Old Bibo session ${session.id} has no NCP journal`);
    const lastUiAssistant = [...session.messages].reverse().find((message) => message.role === "assistant");
    const lastNcpAssistant = [...(record?.messages ?? [])].reverse().find((message) => message.role === "assistant" && message.status === "final");
    const lastNcpText = lastNcpAssistant?.parts.filter((part) => part.type === "text").map((part) => part.text).join("");
    if (lastUiAssistant && lastNcpText !== lastUiAssistant.text) {
      const finalTexts = (record?.messages ?? []).filter((message) => message.role === "assistant" && message.status === "final")
        .map((message) => message.parts.filter((part) => part.type === "text").map((part) => part.text).join(""));
      throw new Error(`Old Bibo session ${session.id} differs from its NCP journal (uiCount=${session.messages.length}, ncpCount=${record?.messages.length ?? 0}, uiChars=${lastUiAssistant.text.length}, ncpChars=${lastNcpText?.length ?? 0}, earlierMatch=${finalTexts.includes(lastUiAssistant.text)}, finalCount=${finalTexts.length})`);
    }
  }
  const visibleSessionIds = new Set(uiSessions.map((session) => session.id));
  if (source.sessions.some(({ sessionId, record }) => visibleSessionIds.has(sessionId) && record?.messages.some((message) => message.status === "pending" || message.status === "streaming"))) {
    throw new Error("An old Bibo session has an unfinished NCP message");
  }
  const fileIds = new Set(source.spaceState.files.filter((file) => file.kind !== "folder").map((file) => file.id));
  if (fileIds.size !== source.files.length || source.files.some((file) => !fileIds.has(file.id))) throw new Error("Bibo file index and exported contents differ");
}

/** Stage and read back every old fact; publish the edge cutover marker only after verification. */
export class BiboEdgeMigrationService {
  private readonly sessions: BiboEdgeSessionStore;
  private readonly space: BiboSpaceStateStore;

  constructor(private readonly storage: DurableObjectStorage) {
    this.sessions = new BiboEdgeSessionStore(storage);
    this.space = new BiboSpaceStateStore(storage);
  }

  private stageSessions = async (source: LegacyExport): Promise<void> => {
    for (const { sessionId, record } of source.sessions) {
      if (!record) continue;
      const next: BiboEdgeSession = { version: 1, messages: record.messages, metadata: record.metadata ?? {} };
      const previous = await this.sessions.load(sessionId);
      const staged = this.sessions.prepareCommit(sessionId, previous, next);
      await this.storage.transaction(async (transaction) => {
        await applyBiboStorageChanges(transaction, staged.entries, staged.deletes);
      });
    }
  };

  private stageSpace = async (source: LegacyExport): Promise<void> => {
    const files = new BiboSpaceFileStore(this.storage);
    const byId = new Map(source.spaceState.files.map((file) => [file.id, file]));
    for (const { id, content } of source.files) await files.create(byId.get(id) as BiboFile, content);
    const workspaceEntries: Record<string, unknown> = { edgeWorkspaceIndex: Object.keys(source.workspaceTexts), agentDeliveries: source.deliveries };
    for (const [path, content] of Object.entries(source.workspaceTexts)) {
      if (path.length > 512 || path.split("/").some((part) => !part || part === "." || part === ".." || part.startsWith(".") || !/^[a-zA-Z0-9._-]+$/.test(part))) {
        throw new Error("Invalid workspace text path");
      }
      workspaceEntries[workspaceKey(path)] = content;
    }
    await this.space.save(source.spaceState as BiboSpaceState, workspaceEntries, files);
  };

  private verify = async (source: LegacyExport): Promise<void> => {
    const actualSpace = await this.space.load();
    if (JSON.stringify(actualSpace) !== JSON.stringify(source.spaceState)) throw new Error("Bibo space migration verification failed");
    for (const { sessionId, record } of source.sessions) {
      if (!record) continue;
      const actual = await this.sessions.load(sessionId);
      if (JSON.stringify(actual?.messages) !== JSON.stringify(record.messages) || JSON.stringify(actual?.metadata) !== JSON.stringify(record.metadata ?? {})) {
        throw new Error(`Bibo session ${sessionId} migration verification failed`);
      }
    }
    const readFiles = new BiboSpaceFileStore(this.storage);
    const byId = new Map(source.spaceState.files.map((file) => [file.id, file]));
    for (const { id, content } of source.files) {
      if (await readFiles.read(byId.get(id) as BiboFile) !== content) throw new Error(`Bibo file ${id} migration verification failed`);
    }
    for (const [path, content] of Object.entries(source.workspaceTexts)) {
      if (await this.storage.get<string>(workspaceKey(path)) !== content) throw new Error(`Bibo workspace ${path} migration verification failed`);
    }
  };

  migrate = async (source: LegacyExport, uiSessions: readonly UiSession[]): Promise<MigrationEvidence> => {
    if (await this.storage.get<string>("conversationMode") === "edge") throw new Error("Bibo user already has edge conversation writes");
    source = recoverVisibleReply(source, uiSessions);
    validateExport(source, uiSessions);
    const current = await this.space.load();
    if (current && JSON.stringify(current) !== JSON.stringify(source.spaceState)) throw new Error("Bibo structured space changed during migration");
    await this.stageSessions(source);
    await this.stageSpace(source);
    await this.verify(source);
    await this.storage.put("conversationMode", "edge");
    return { sessions: source.sessions.filter((item) => item.record).length,
      messages: source.sessions.reduce((total, item) => total + (item.record?.messages.length ?? 0), 0),
      files: source.files.length, workspaceTexts: Object.keys(source.workspaceTexts).length };
  };
}
