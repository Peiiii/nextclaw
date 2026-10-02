import type { StoreApi } from "zustand";
import type { BiboClient, BiboFile, BiboFileDetail } from "@nextclaw/bibo-client";
import type { useBiboSpaceStore } from "@/features/space/stores/bibo-space.store";
import { directoryFileState } from "@/features/space/utils/file-state.utils";
import { revealedFileLayout, writeWorkspaceLayout } from "@/features/space/utils/workspace-layout.utils";

type SpaceState = ReturnType<typeof useBiboSpaceStore.getState>;
export type FileDirectories = Record<string, { cursor: string | null; pages: number; status: "loading" | "ready" | "error"; error: string }>;

/** Owns directory reads and pagination for one account, shared by the tree and breadcrumbs. */
export class FileDirectoryManager {
  private readonly requests = new Map<string, number>();
  private refreshRequest = 0;
  private searchRequest = 0;
  constructor(private readonly store: StoreApi<SpaceState>, private readonly client: BiboClient) {}
  private active = (): boolean => this.store.getState().fileDirectory === this;
  private patch = (update: (state: SpaceState) => Partial<SpaceState>): void => {
    if (this.active()) this.store.setState(update);
  };
  toggle = (id: string): void => {
    this.patch(state => ({ expandedFolders: { ...state.expandedFolders, [id]: !state.expandedFolders[id] } }));
    const state = this.store.getState();
    writeWorkspaceLayout(state);
    const file = state.files.find(file => file.id === id);
    if (file && state.expandedFolders[id]) void this.load(file.path);
  };
  refresh = async (): Promise<void> => {
    if (!await this.load()) throw new Error(this.store.getState().directories[""]?.error);
    await this.refreshExpanded();
  };
  loadAncestors = async (detail: BiboFileDetail): Promise<void> => {
    if (!this.active() || !detail.path.includes("/")) return;
    try {
      const ancestors = await this.client.space<{ items: BiboFile[] }>("file.list", { ancestorOf: detail.path, limit: 100 });
      if (!this.active() || this.store.getState().fileDetails[detail.id]?.path !== detail.path) return;
      this.patch(state => ({ files: [...new Map([...ancestors.items, ...state.files].map(file => [file.id, file])).values()] }));
      const state = this.store.getState();
      if (state.view === "files" && state.activeFileId === detail.id && !state.fileBrowserVisible) {
        this.patch(current => revealedFileLayout(current, detail.id));
        writeWorkspaceLayout(this.store.getState());
      }
    } catch { /* Directory navigation can retry its own reads; the document remains available. */ }
  };
  search = async (query: string, more = false): Promise<void> => {
    if (!this.active()) return;
    const state = this.store.getState();
    if (more && (state.fileSearchLoading || query !== state.fileQuery || !state.fileSearchCursor)) return;
    const cursor = more ? state.fileSearchCursor : null;
    const request = ++this.searchRequest;
    const current = () => this.active() && request === this.searchRequest;
    this.patch(() => ({ fileQuery: query, fileSearchLoading: !!query.trim(), fileSearchError: "", ...(more ? {} : { fileMatches: [], fileSearchCursor: null }) }));
    if (!query.trim()) return;
    try {
      const page = await this.client.space<{ items: BiboFile[]; nextCursor: string | null }>("file.list", { query, limit: 50, ...(cursor ? { cursor } : {}) });
      if (current()) this.patch(state => ({ fileMatches: more ? [...state.fileMatches, ...page.items] : page.items, fileSearchCursor: page.nextCursor }));
    } catch (error) { if (current()) this.patch(() => ({ fileSearchError: error instanceof Error ? error.message : "暂时无法搜索文件。" })); }
    finally { if (current()) this.patch(() => ({ fileSearchLoading: false })); }
  };

  load = async (path = "", more = false): Promise<boolean> => {
    if (!this.active()) return false;
    const previous = this.store.getState().directories[path];
    if (more && (!previous?.cursor || previous.status === "loading")) return true;
    const request = (this.requests.get(path) ?? 0) + 1;
    this.requests.set(path, request);
    const current = () => this.active() && this.requests.get(path) === request;
    this.patch(state => ({ directories: { ...state.directories, [path]: { cursor: previous?.cursor ?? null, pages: previous?.pages ?? 1, status: "loading", error: "" } } }));
    try {
      let cursor = more ? previous!.cursor : null;
      const items: BiboFile[] = [];
      let pages = 0;
      do {
        const page = await this.client.space<{ items: BiboFile[]; nextCursor: string | null }>("file.list", { parentPath: path, limit: 100, ...(cursor ? { cursor } : {}) });
        if (!current()) return true;
        items.push(...page.items);
        cursor = page.nextCursor;
        pages++;
      } while (!more && cursor && pages < (previous?.pages ?? 1));
      this.patch(state => {
        const files = directoryFileState(state.files, path, items, !more && !cursor);
        const folders = new Set(files.filter(file => file.kind === "folder").map(file => file.path));
        const directories = { ...state.directories };
        if (!more && !cursor) for (const directory of Object.keys(directories)) {
          if (directory && directory !== path && !folders.has(directory)) {
            delete directories[directory];
            this.requests.set(directory, (this.requests.get(directory) ?? 0) + 1);
          }
        }
        directories[path] = { cursor, pages: more ? previous!.pages + 1 : pages, status: "ready", error: "" };
        return { files, directories };
      });
      return true;
    } catch (error) {
      if (current()) this.patch(state => ({ directories: { ...state.directories, [path]: { ...state.directories[path]!, status: "error", error: error instanceof Error ? error.message : "暂时无法读取目录。" } } }));
      return false;
    }
  };

  private refreshExpanded = async (): Promise<void> => {
    const request = ++this.refreshRequest;
    const refreshed = new Set<string>();
    while (this.active() && request === this.refreshRequest) {
      const state = this.store.getState();
      const folders = state.files.filter(file => file.kind === "folder" && !refreshed.has(file.path) &&
        (state.expandedFolders[file.id] || state.directories[file.path]));
      if (!folders.length) break;
      for (const folder of folders) refreshed.add(folder.path);
      await Promise.all(folders.map(file => this.load(file.path)));
    }
  };
}
