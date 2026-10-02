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
  constructor(private readonly store: StoreApi<SpaceState>, private readonly client: BiboClient,
    private readonly pendingCreates: Map<string, string>, private readonly patch: (update: Patch) => void) {}
  private active = (): boolean => this.store.getState().fileEditing === this;

  createFile = async (path: string, kind: BiboFile["kind"]): Promise<boolean> => {
    const state = this.store.getState();
    if (!this.active()) return false;
    const detail = await state.act<BiboFileDetail>("file.create", { path, kind, content: "" }, state.view === "notes" ? "notes" : "files");
    if (detail && this.active() && kind !== "folder") await this.store.getState().openFile(detail.id, detail);
    return detail !== null;
  };

  save = async (id: string): Promise<void> => {
    const state = this.store.getState(), draft = state.fileDrafts[id];
    if (!this.active() || !draft || !draft.dirty || draft.saving || state.fileDetails[id]?.preview) return;
    this.patch(state => ({ fileDrafts: { ...state.fileDrafts, [id]: { ...draft, saving: true, error: undefined } } }));
    try {
      const detail = await this.client.space<BiboFileDetail>("file.update", { id, version: draft.version, content: draft.content });
      if (!this.active()) return;
      this.patch(state => savedFileState(state, detail, draft.content));
      await this.store.getState().load(this.store.getState().view === "notes" ? "notes" : "files");
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
