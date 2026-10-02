import type { StoreApi } from "zustand";
import { BiboClientError, type BiboClient, type BiboFile, type BiboFileDetail } from "@nextclaw/bibo-client";
import type { useBiboSpaceStore } from "@/features/space/stores/bibo-space.store";
import { savedFileState } from "@/features/space/utils/file-state.utils";
import { biboCopy } from "@/shared/configs/bibo-copy.config";

type SpaceState = ReturnType<typeof useBiboSpaceStore.getState>;
type Patch = Partial<SpaceState> | ((state: SpaceState) => Partial<SpaceState>);
const message = (error: unknown) => error instanceof Error ? error.message : "操作暂时失败，请稍后再试。";

/** File write workflows for one account; draft persistence remains with the space store's writer. */
export class FileEditingManager {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private releaseEvents?: () => void;
  constructor(private readonly store: StoreApi<SpaceState>, private readonly client: BiboClient,
    private readonly pendingCreates: Map<string, string>, private readonly patch: (update: Patch) => void) {}
  private active = (): boolean => this.store.getState().fileEditing === this;

  start = (): void => {
    if (!this.active() || !this.store.getState().accountId || this.releaseEvents || typeof window === "undefined" || !window.addEventListener) return;
    const host = window, page = typeof document === "undefined" ? null : document;
    const online = () => { this.patch({ fileOffline: false }); this.flush(); };
    const offline = () => this.patch({ fileOffline: true });
    const hidden = () => { if (page?.visibilityState === "hidden") this.flush(); };
    host.addEventListener("online", online);
    host.addEventListener("offline", offline);
    host.addEventListener("pagehide", this.flush);
    page?.addEventListener("visibilitychange", hidden);
    this.releaseEvents = () => {
      host.removeEventListener("online", online);
      host.removeEventListener("offline", offline);
      host.removeEventListener("pagehide", this.flush);
      page?.removeEventListener("visibilitychange", hidden);
    };
    this.patch({ fileOffline: typeof navigator !== "undefined" && navigator.onLine === false });
  };

  destroy = (): void => {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.releaseEvents?.();
    this.releaseEvents = undefined;
  };

  sync = (previous: SpaceState): void => {
    const state = this.store.getState();
    for (const id of this.timers.keys()) if (!state.fileDrafts[id]) this.cancel(id);
    for (const [id, draft] of Object.entries(state.fileDrafts)) {
      if (!state.accountId || !state.fileDetails[id] || state.fileDetails[id].preview || state.fileOffline || !draft.dirty || draft.saving || draft.error || draft.conflict) { this.cancel(id); continue; }
      const before = previous.fileDrafts[id];
      if (before?.content === draft.content && previous.fileDetails[id] && !before.saving) continue;
      this.cancel(id);
      this.timers.set(id, setTimeout(() => { this.timers.delete(id); void this.save(id); }, 1000));
    }
  };

  private cancel = (id: string): void => { clearTimeout(this.timers.get(id)); this.timers.delete(id); };
  private flush = (): void => {
    if (!this.active() || !this.store.getState().accountId) return;
    for (const id of Object.keys(this.store.getState().fileDrafts)) void this.save(id);
  };

  createFile = async (path: string, kind: BiboFile["kind"]): Promise<boolean> => {
    const state = this.store.getState();
    if (!this.active()) return false;
    const detail = await state.act<BiboFileDetail>("file.create", { path, kind, content: "" }, state.view === "notes" ? "notes" : "files");
    if (detail && this.active() && kind !== "folder") await this.store.getState().openFile(detail.id, detail);
    return detail !== null;
  };

  save = async (id: string): Promise<void> => {
    const state = this.store.getState(), draft = state.fileDrafts[id];
    if (!this.active() || !draft || !draft.dirty || draft.saving || draft.conflict || state.fileOffline || !state.fileDetails[id] || state.fileDetails[id].preview) return;
    this.cancel(id);
    this.patch(state => ({ fileDrafts: { ...state.fileDrafts, [id]: { ...draft, saving: true, error: undefined } } }));
    try {
      const detail = await this.client.space<BiboFileDetail>("file.update", { id, version: draft.version, content: draft.content });
      if (!this.active()) return;
      this.patch(state => savedFileState(state, detail, draft.content));
    } catch (error) {
      const conflict = error instanceof BiboClientError && error.status === 409;
      this.patch(state => state.fileDrafts[id] ? { fileDrafts: { ...state.fileDrafts, [id]: { ...state.fileDrafts[id]!, saving: false, conflict: conflict || state.fileDrafts[id]!.conflict, error: conflict ? undefined : message(error) } } } : {});
    }
  };

  resolveConflict = async (id: string, choice: "reload" | "overwrite"): Promise<void> => {
    const draft = this.store.getState().fileDrafts[id];
    if (!this.active() || !draft || draft.saving) return;
    this.patch(state => ({ fileDrafts: { ...state.fileDrafts, [id]: { ...draft, saving: true, error: undefined } } }));
    try {
      const latest = await this.client.space<BiboFileDetail>("file.get", { id });
      if (!this.active() || !this.store.getState().fileDrafts[id]) return;
      if (choice === "overwrite" && latest.preview) throw new Error(biboCopy.filePreviewReadOnly);
      this.patch(state => ({ fileDetails: { ...state.fileDetails, [id]: latest }, files: state.files.map(file => file.id === id ? latest : file), notes: state.notes.map(note => note.id === id ? latest : note), fileDrafts: { ...state.fileDrafts, [id]: { content: choice === "reload" ? latest.content ?? "" : state.fileDrafts[id]!.content, version: latest.version, dirty: choice === "overwrite", saving: false } } }));
      if (choice === "overwrite") await this.save(id);
    } catch (error) { this.patch(state => state.fileDrafts[id] ? { fileDrafts: { ...state.fileDrafts, [id]: { ...state.fileDrafts[id]!, error: message(error) } } } : {}); }
    finally { this.patch(state => state.fileDrafts[id] ? { fileDrafts: { ...state.fileDrafts, [id]: { ...state.fileDrafts[id]!, saving: false } } } : {}); }
  };

  createNote = async (): Promise<boolean> => {
    if (!this.active() || this.store.getState().saving) return false;
    this.patch({ saving: true, actionError: "", noteQuery: "" });
    try {
      const detail = await this.createUniqueNote();
      if (!detail || !this.active()) return false;
      this.patch({ createdFileId: detail.id });
      await this.store.getState().openFile(detail.id, detail);
      void this.store.getState().load("notes");
      return true;
    } catch (error) { this.patch({ actionError: message(error) }); return false; }
    finally { this.patch({ saving: false }); }
  };

  private createUniqueNote = async (): Promise<BiboFileDetail | null> => {
    const state = this.store.getState();
    const parent = state.files.some(file => file.kind === "folder" && file.path === "笔记") ? "笔记/" : "";
    const paths = new Set([...state.files, ...state.notes].map(file => file.path));
    for (let number = 1; number <= 100 && this.active(); number += 1) {
      const name = `${biboCopy.untitledNote}${number === 1 ? "" : ` ${number}`}`;
      const path = `${parent}${name}.md`;
      if (paths.has(path)) continue;
      const input = { path, kind: "note", content: `# ${name}\n\n` };
      const key = JSON.stringify({ action: "file.create", input });
      const requestId = this.pendingCreates.get(key) ?? crypto.randomUUID();
      this.pendingCreates.set(key, requestId);
      try {
        const detail = await this.client.space<BiboFileDetail>("file.create", { ...input, requestId });
        this.pendingCreates.delete(key);
        return this.active() ? detail : null;
      } catch (error) {
        if (!this.active()) return null;
        if (!(error instanceof BiboClientError) || error.status !== 409) throw error;
        this.pendingCreates.delete(key);
      }
    }
    if (this.active()) throw new Error(biboCopy.noteNameUnavailable);
    return null;
  };
}
