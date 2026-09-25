import { create, type StoreApi } from "zustand";
import { BiboClient, BiboClientError, type BiboEvent, type BiboFile, type BiboFileDetail, type BiboInboxItem, type BiboOverview, type BiboProject, type BiboTask } from "@nextclaw/bibo-client";
import { calendarMonthDates } from "@/features/space/utils/calendar.utils";
import { readWorkspaceLayout, writeWorkspaceLayout } from "@/features/space/utils/workspace-layout.utils";

export type BiboView = "overview" | "chat" | "inbox" | "calendar" | "tasks" | "notes" | "files";
type Page<T> = { items: T[]; nextCursor: string | null };
type FileDraft = { content: string; version: number; dirty: boolean; saving: boolean; conflict?: boolean };
export type TaskDraft = Pick<BiboTask, "title" | "description" | "status" | "priority" | "subtasks"> & { projectId: string; startAt: string; dueAt: string; version: number | null };
export type EventDraft = { title: string; description: string; startAt: string; endAt: string; version: number | null };
const client = new BiboClient();
const message = (error: unknown) => error instanceof Error ? error.message : "操作暂时失败，请稍后再试。";
const views: BiboView[] = ["overview", "chat", "inbox", "calendar", "tasks", "notes", "files"];

class BiboSpaceOwner {
  private readonly instanceId = Symbol("space-owner");
  accountId: string | null = null;
  calendarDate = new Date();
  private calendarRevision = 0;
  private readonly loadedCalendarMonths = new Set<string>();
  private readonly calendarRequests = new Map<string, Promise<void>>();
  private readonly pendingCreates = new Map<string, string>();
  private fileOpenRequest = 0;
  private readonly closedFiles = new Set<string>();
  view: BiboView = "overview";
  sidebarCollapsed = false;
  treeCollapsed = false;
  treeWidth = 230;
  expandedFolders: Record<string, boolean> = {};
  fileBrowserVisible = true;
  workspaceOpen = false;
  workspaceFileId: string | null = null;
  loading = false;
  saving = false;
  error = "";
  notice = "";
  overview: BiboOverview | null = null;
  projects: BiboProject[] = [];
  tasks: BiboTask[] = [];
  taskQuery = "";
  taskProject = "";
  events: BiboEvent[] = [];
  inbox: BiboInboxItem[] = [];
  files: BiboFile[] = [];
  notes: BiboFile[] = [];
  fileQuery = "";
  fileMatches: BiboFile[] = [];
  fileSearchCursor: string | null = null;
  fileSearchLoading = false;
  fileSearchError = "";
  moreLoading: Record<string, boolean> = {};
  cursors: Record<string, string | null> = {};
  selectedTaskId: string | null = null;
  taskSelection: BiboTask | null = null;
  selectedEventId: string | null = null;
  selectedInboxId: string | null = null;
  tabs: string[] = [];
  activeFileId: string | null = null;
  fileDetails: Record<string, BiboFileDetail> = {};
  fileDrafts: Record<string, FileDraft> = {};
  taskDrafts: Record<string, TaskDraft> = {};
  eventDrafts: Record<string, EventDraft> = {};

  constructor(private readonly setState: StoreApi<BiboSpaceOwner>["setState"], private readonly get: StoreApi<BiboSpaceOwner>["getState"]) {}

  private set = (update: Partial<BiboSpaceOwner> | ((state: BiboSpaceOwner) => Partial<BiboSpaceOwner>)): void => {
    if (this.get()?.instanceId === this.instanceId) this.setState(update);
  };

  bindAccount = (accountId: string | null, reset = false): void => {
    if (this.accountId === accountId && !reset) return;
    const owner = new BiboSpaceOwner(this.setState, this.get);
    owner.accountId = accountId;
    if (accountId && !reset) Object.assign(owner, readWorkspaceLayout(accountId));
    this.setState(owner, true);
    owner.syncLocation();
    if (accountId) void owner.load();
  };

  private saveLayout = (): void => writeWorkspaceLayout(this.get());

  syncLocation = (): void => {
    const view = new URLSearchParams(window.location.search).get("view");
    this.set({ view: views.includes(view as BiboView) ? view as BiboView : "overview" });
  };

  navigate = (view: BiboView): void => {
    if (this.get().view === view) return;
    const url = new URL(window.location.href);
    if (view === "overview") url.searchParams.delete("view");
    else url.searchParams.set("view", view);
    window.history.pushState({}, "", url);
    this.set({ view, error: "", notice: "", ...(["files", "notes"].includes(view) ? { fileBrowserVisible: true } : {}) });
    if (view !== "chat") void this.load(view);
  };

  toggleSidebar = (): void => { this.set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })); this.saveLayout(); };
  toggleTree = (): void => { this.set((state) => ({ treeCollapsed: !state.treeCollapsed })); this.saveLayout(); };
  resizeTree = (width: number): void => { this.set({ treeWidth: Math.min(360, Math.max(180, width)) }); this.saveLayout(); };
  toggleFolder = (id: string): void => { this.set((state) => ({ expandedFolders: { ...state.expandedFolders, [id]: !state.expandedFolders[id] } })); this.saveLayout(); };
  showFileBrowser = (): void => this.set({ fileBrowserVisible: true });
  searchFiles = async (query: string, more = false): Promise<void> => {
    if (more && (this.get().fileSearchLoading || query !== this.get().fileQuery || !this.get().fileSearchCursor)) return;
    const cursor = more ? this.get().fileSearchCursor : null;
    this.set({ fileQuery: query, fileSearchLoading: !!query.trim(), fileSearchError: "", ...(more ? {} : { fileMatches: [], fileSearchCursor: null }) });
    if (!query.trim()) return;
    try {
      const page = await client.space<Page<BiboFile>>("file.list", { query, limit: 50, ...(cursor ? { cursor } : {}) });
      if (this.get().fileQuery !== query) return;
      this.set((state) => ({ fileMatches: more ? [...state.fileMatches, ...page.items] : page.items, fileSearchCursor: page.nextCursor }));
    } catch (error) { if (this.get().fileQuery === query) this.set({ fileSearchError: message(error) }); }
    finally { if (this.get().fileQuery === query) this.set({ fileSearchLoading: false }); }
  };
  private revealFile = (id: string): void => {
    const state = this.get();
    const file = state.files.find((item) => item.id === id) ?? state.fileDetails[id];
    if (!file) return;
    const expandedFolders = { ...state.expandedFolders };
    for (const folder of state.files) if (folder.kind === "folder" && file.path.startsWith(`${folder.path}/`)) expandedFolders[folder.id] = true;
    this.set({ expandedFolders, fileBrowserVisible: false, fileQuery: "", fileMatches: [], fileSearchLoading: false });
    this.saveLayout();
  };
  closeWorkspace = (): void => { this.set({ workspaceOpen: false }); this.saveLayout(); };
  showWorkspace = (): void => { this.set({ workspaceOpen: true }); this.saveLayout(); void this.load("files"); };
  openWorkspace = async (id: string): Promise<void> => {
    this.set({ workspaceOpen: true, workspaceFileId: id, error: "" });
    this.saveLayout();
    await this.openFile(id);
  };
  selectTask = (id: string | null, verified?: BiboTask): void => {
    const known = verified ?? this.get().tasks.find((task) => task.id === id) ?? null;
    this.set({ selectedTaskId: id, taskSelection: known });
    if (!id || known) return;
    void client.space<BiboTask>("task.get", { id }).then((task) => {
      if (this.get().selectedTaskId === id) this.set({ taskSelection: task });
    }).catch((error) => { if (this.get().selectedTaskId === id) this.set({ error: message(error) }); });
  };
  setCalendarDate = (date: Date): void => {
    this.set({ calendarDate: date });
    void this.loadCalendarMonth(date).catch(() => { /* The range loader exposes its error in the store. */ });
  };
  filterTasks = (query: string, project: string): void => {
    this.set({ taskQuery: query, taskProject: project, selectedTaskId: null });
    void this.load("tasks");
  };
  selectEvent = (id: string | null, verified?: BiboEvent): void => {
    this.set({ selectedEventId: id });
    if (!id) return;
    const known = verified ?? this.get().events.find((event) => event.id === id);
    if (verified) this.set((state) => ({ events: [...state.events.filter((event) => event.id !== id), verified] }));
    if (known) { this.setCalendarDate(new Date(known.startAt)); return; }
    void client.space<BiboEvent>("event.get", { id }).then((event) => {
      this.set((state) => ({ events: [...state.events.filter((item) => item.id !== id), event] }));
      if (this.get().selectedEventId === id) this.setCalendarDate(new Date(event.startAt));
    }).catch((error) => this.set({ error: message(error) }));
  };
  selectInbox = (id: string | null): void => this.set({ selectedInboxId: id });
  clearNotice = (): void => this.set({ notice: "" });
  keepTaskDraft = (id: string, draft: TaskDraft): void => this.set((state) => ({ taskDrafts: { ...state.taskDrafts, [id]: draft } }));
  clearTaskDraft = (id: string): void => this.set((state) => { const drafts = { ...state.taskDrafts }; delete drafts[id]; return { taskDrafts: drafts }; });
  keepEventDraft = (id: string, draft: EventDraft): void => this.set((state) => ({ eventDrafts: { ...state.eventDrafts, [id]: draft } }));
  clearEventDraft = (id: string): void => this.set((state) => { const drafts = { ...state.eventDrafts }; delete drafts[id]; return { eventDrafts: drafts }; });

  refreshAfterChat = async (): Promise<void> => {
    this.loadedCalendarMonths.clear();
    this.calendarRevision += 1;
    await this.load("overview");
    const view = this.get().view;
    if (view !== "overview" && view !== "chat") await this.load(view);
    if (this.get().workspaceOpen) await this.load("files");
    for (const id of this.get().tabs) {
      if (this.get().fileDrafts[id]?.dirty) continue;
      try {
        const detail = await client.space<BiboFileDetail>("file.get", { id });
        this.set((state) => ({ fileDetails: { ...state.fileDetails, [id]: detail }, fileDrafts: { ...state.fileDrafts, [id]: { content: detail.content ?? "", version: detail.version, dirty: false, saving: false } } }));
      } catch { /* A deleted file remains visible until the user closes its tab. */ }
    }
  };

  load = async (view: BiboView = this.get().view): Promise<boolean> => {
    if (view === "chat") return this.get().workspaceOpen ? this.load("files") : true;
    this.set({ loading: true, error: "" });
    try {
      if (view === "overview") this.set({ overview: await client.space<BiboOverview>("overview.get") });
      if (view === "tasks") {
        const { taskQuery, taskProject } = this.get();
        const [projects, tasks] = await Promise.all([client.space<Page<BiboProject>>("project.list", { limit: 100 }), client.space<Page<BiboTask>>("task.list", { limit: 100, query: taskQuery, ...(taskProject ? { projectId: taskProject } : {}) })]);
        if (taskQuery !== this.get().taskQuery || taskProject !== this.get().taskProject) return true;
        this.set({ projects: projects.items, tasks: tasks.items, cursors: { ...this.get().cursors, tasks: tasks.nextCursor } });
      }
      if (view === "calendar") {
        await this.loadCalendarMonth(this.get().calendarDate);
      }
      if (view === "inbox") {
        const inbox = await client.space<Page<BiboInboxItem>>("inbox.list", { limit: 100 });
        this.set({ inbox: inbox.items, cursors: { ...this.get().cursors, inbox: inbox.nextCursor } });
      }
      if (view === "files" || view === "notes") {
        const [files, notes] = await Promise.all([
          client.space<Page<BiboFile>>("file.list", { limit: 100 }),
          view === "notes" ? client.space<Page<BiboFile>>("file.list", { kind: "note", sort: "recent", limit: 100 }) : Promise.resolve(null),
        ]);
        this.set({ files: files.items, ...(notes ? { notes: notes.items } : {}), cursors: { ...this.get().cursors, files: files.nextCursor, ...(notes ? { notes: notes.nextCursor } : {}) } });
        const active = this.get().activeFileId;
        if (active && !this.get().fileDetails[active]) await this.openFile(active);
        const workspace = this.get().workspaceFileId;
        if (this.get().workspaceOpen && workspace && workspace !== active && !this.get().fileDetails[workspace]) await this.openFile(workspace);
      }
      return true;
    } catch (error) { this.set({ error: message(error) }); return false; }
    finally { this.set({ loading: false }); }
  };

  loadCalendarMonth = async (date: Date): Promise<void> => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const revision = this.calendarRevision;
    const key = `${revision}-${year}-${month}`;
    if (this.loadedCalendarMonths.has(key)) return;
    const existing = this.calendarRequests.get(key);
    if (existing) return existing;
    const dates = calendarMonthDates(date);
    const from = dates[0]!.toISOString();
    const last = dates.at(-1)!;
    const to = new Date(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1).getTime() - 1).toISOString();
    this.set({ error: "" });
    const request = (async () => {
      const events: BiboEvent[] = [];
      let cursor: string | null = null;
      do {
        const page: Page<BiboEvent> = await client.space<Page<BiboEvent>>("event.list", { from, to, limit: 100, ...(cursor ? { cursor } : {}) });
        events.push(...page.items);
        cursor = page.nextCursor;
      } while (cursor);
      if (revision !== this.calendarRevision) return;
      this.set((state) => {
        const remaining = state.events.filter((event) => event.endAt < from || event.startAt > to);
        return { events: [...new Map([...remaining, ...events].map((event) => [event.id, event])).values()].sort((a, b) => a.startAt.localeCompare(b.startAt)), cursors: { ...state.cursors, events: null } };
      });
      this.loadedCalendarMonths.add(key);
    })().catch((error) => { this.set({ error: message(error) }); throw error; }).finally(() => this.calendarRequests.delete(key));
    this.calendarRequests.set(key, request);
    return request;
  };

  loadMore = async (domain: "tasks" | "events" | "inbox" | "files" | "notes"): Promise<void> => {
    const cursor = this.get().cursors[domain];
    if (!cursor || this.get().moreLoading[domain]) return;
    this.set((state) => ({ moreLoading: { ...state.moreLoading, [domain]: true } }));
    const action = { tasks: "task.list", events: "event.list", inbox: "inbox.list", files: "file.list", notes: "file.list" }[domain];
    try {
      const { taskQuery, taskProject } = this.get();
      const result = await client.space<Page<unknown>>(action, { limit: 100, cursor, ...(domain === "tasks" ? { query: taskQuery, ...(taskProject ? { projectId: taskProject } : {}) } : {}), ...(domain === "notes" ? { kind: "note", sort: "recent" } : {}) });
      if (domain === "tasks" && (taskQuery !== this.get().taskQuery || taskProject !== this.get().taskProject)) return;
      this.set((state) => state.cursors[domain] === cursor ? { [domain]: [...(state[domain] as unknown[]), ...result.items], cursors: { ...state.cursors, [domain]: result.nextCursor } } : {});
    } catch (error) { this.set({ error: message(error) }); }
    finally { this.set((state) => ({ moreLoading: { ...state.moreLoading, [domain]: false } })); }
  };

  act = async <T>(action: string, input: Record<string, unknown>, view: BiboView): Promise<T | null> => {
    if (this.get().saving) return null;
    this.set({ error: "", notice: "", saving: true });
    const requestKey = action.endsWith(".create") ? JSON.stringify({ action, input }) : null;
    const requestId = requestKey ? this.pendingCreates.get(requestKey) ?? crypto.randomUUID() : null;
    if (requestKey && requestId) this.pendingCreates.set(requestKey, requestId);
    try {
      const result = await client.space<T>(action, { ...input, ...(requestId ? { requestId } : {}) });
      if (requestKey) this.pendingCreates.delete(requestKey);
      if (action.startsWith("event.")) { this.loadedCalendarMonths.clear(); this.calendarRevision += 1; }
      const refreshed = await this.load(view);
      const overviewRefreshed = view === "overview" || await this.load("overview");
      this.set({ notice: refreshed && overviewRefreshed ? "已保存。" : "已保存，视图暂未刷新。请重试读取。" });
      return result;
    } catch (error) { this.set({ error: message(error) }); return null; }
    finally { this.set({ saving: false }); }
  };

  openFile = async (id: string, verified?: BiboFileDetail): Promise<void> => {
    const request = ++this.fileOpenRequest;
    this.closedFiles.delete(id);
    const cached = verified ? undefined : this.get().fileDetails[id];
    if (cached) {
      this.set((state) => ({ activeFileId: id, tabs: state.tabs.includes(id) ? state.tabs : [...state.tabs, id] }));
      this.revealFile(id);
      return;
    }
    try {
      const detail = verified ?? await client.space<BiboFileDetail>("file.get", { id });
      const ancestors = detail.path.includes("/") ? await client.space<Page<BiboFile>>("file.list", { ancestorOf: detail.path, limit: 100 }) : { items: [] };
      if (this.closedFiles.has(id)) return;
      this.set((state) => ({ files: [...new Map([...state.files, ...ancestors.items, detail].map((file) => [file.id, file])).values()] }));
      this.set((state) => ({ fileDetails: { ...state.fileDetails, [id]: detail }, fileDrafts: { ...state.fileDrafts,
        [id]: state.fileDrafts[id]?.dirty || state.fileDrafts[id]?.saving ? state.fileDrafts[id]! : { content: detail.content ?? "", version: detail.version, dirty: false, saving: false } },
        tabs: state.tabs.includes(id) ? state.tabs : [...state.tabs, id], ...(request === this.fileOpenRequest ? { activeFileId: id, error: "" } : {}) }));
      if (request === this.fileOpenRequest) this.revealFile(id);
    } catch (error) {
      if (error instanceof BiboClientError && error.status === 404 && this.get().workspaceFileId !== id && this.get().tabs.includes(id) && !this.get().fileDrafts[id]) this.closeFile(id);
      if (request === this.fileOpenRequest) this.set({ error: message(error) });
    }
  };

  closeFile = (id: string, discard = false): void => {
    const draft = this.get().fileDrafts[id];
    if (draft?.saving || (draft?.dirty && !discard)) return;
    this.closedFiles.add(id);
    this.set((state) => {
      const tabs = state.tabs.filter((tab) => tab !== id);
      const fileDetails = { ...state.fileDetails }; delete fileDetails[id];
      const fileDrafts = { ...state.fileDrafts }; delete fileDrafts[id];
      const neighbor = state.tabs[state.tabs.indexOf(id) + 1] ?? state.tabs[state.tabs.indexOf(id) - 1] ?? null;
      return { tabs, fileDetails, fileDrafts, activeFileId: state.activeFileId === id ? neighbor : state.activeFileId, fileBrowserVisible: tabs.length === 0 ? true : state.fileBrowserVisible,
        workspaceOpen: state.workspaceFileId === id ? false : state.workspaceOpen };
    });
    this.saveLayout();
    const active = this.get().activeFileId;
    if (active && !this.get().fileDetails[active]) void this.openFile(active);
  };

  editFile = (id: string, content: string): void => this.set((state) => ({ fileDrafts: { ...state.fileDrafts, [id]: { ...state.fileDrafts[id]!, content, dirty: true } } }));

  saveFile = async (id: string): Promise<void> => {
    const draft = this.get().fileDrafts[id];
    if (!draft || !draft.dirty || draft.saving) return;
    this.set((state) => ({ fileDrafts: { ...state.fileDrafts, [id]: { ...draft, saving: true } }, error: "" }));
    try {
      const detail = await client.space<BiboFileDetail>("file.update", { id, version: draft.version, content: draft.content });
      this.set((state) => {
        const current = state.fileDrafts[id];
        if (!current) return {};
        const editedDuringSave = current.content !== draft.content;
        return { fileDetails: { ...state.fileDetails, [id]: detail }, fileDrafts: { ...state.fileDrafts, [id]: { content: editedDuringSave ? current!.content : detail.content ?? "", version: detail.version, dirty: editedDuringSave, saving: false } }, notice: editedDuringSave ? "已保存上一版；继续保存新修改。" : "已保存。" };
      });
      await this.load(this.get().view === "notes" ? "notes" : "files");
    } catch (error) {
      const conflict = error instanceof BiboClientError && error.status === 409;
      this.set((state) => ({ ...(state.fileDrafts[id] ? { fileDrafts: { ...state.fileDrafts, [id]: { ...state.fileDrafts[id]!, saving: false, conflict: conflict || state.fileDrafts[id]!.conflict } } } : {}), error: conflict ? "" : message(error) }));
    }
  };

  resolveFileConflict = async (id: string, choice: "reload" | "overwrite"): Promise<void> => {
    const draft = this.get().fileDrafts[id];
    if (!draft || draft.saving) return;
    this.set((state) => ({ fileDrafts: { ...state.fileDrafts, [id]: { ...draft, saving: true } }, error: "" }));
    try {
      const latest = await client.space<BiboFileDetail>("file.get", { id });
      if (this.get().instanceId !== this.instanceId || !this.get().fileDrafts[id]) return;
      this.set((state) => ({ fileDetails: { ...state.fileDetails, [id]: latest }, files: state.files.map((file) => file.id === id ? latest : file), notes: state.notes.map((note) => note.id === id ? latest : note), fileDrafts: { ...state.fileDrafts, [id]: { content: choice === "reload" ? latest.content ?? "" : state.fileDrafts[id]!.content, version: latest.version, dirty: choice === "overwrite", saving: false } } }));
      if (choice === "overwrite") await this.saveFile(id);
    } catch (error) { this.set({ error: message(error) }); }
    finally { this.set((state) => state.fileDrafts[id] ? { fileDrafts: { ...state.fileDrafts, [id]: { ...state.fileDrafts[id]!, saving: false } } } : {}); }
  };

  createFile = async (path: string, kind: BiboFile["kind"]): Promise<boolean> => {
    const detail = await this.act<BiboFileDetail>("file.create", { path, kind, content: "" }, this.get().view === "notes" ? "notes" : "files");
    if (detail && kind !== "folder") await this.openFile(detail.id);
    return detail !== null;
  };

  moveFile = async (file: BiboFile, path: string): Promise<boolean> => {
    const detail = await this.act<BiboFileDetail>("file.move", { id: file.id, version: file.version, path }, this.get().view === "notes" ? "notes" : "files");
    if (!detail) return false;
    const descendants = Object.values(this.get().fileDetails).filter((cached) => cached.id !== file.id && cached.path.startsWith(`${file.path}/`));
    const refreshed = await Promise.allSettled(descendants.map((cached) => client.space<BiboFileDetail>("file.get", { id: cached.id })));
    this.set((state) => {
      const fileDetails = { ...state.fileDetails };
      const fileDrafts = { ...state.fileDrafts };
      fileDetails[file.id] = detail;
      for (const result of refreshed) if (result.status === "fulfilled") fileDetails[result.value.id] = result.value;
      for (const cached of [file, ...descendants]) {
        const draft = fileDrafts[cached.id];
        const updated = fileDetails[cached.id];
        if (draft && updated) fileDrafts[cached.id] = draft.dirty ? { ...draft, version: draft.version + 1 } : { ...draft, content: updated.content ?? "", version: updated.version };
      }
      return { fileDetails, fileDrafts, ...(refreshed.some((result) => result.status === "rejected") ? { error: "目录已移动，部分已打开文件未能刷新，请重新打开。" } : {}) };
    });
    return true;
  };

  deleteFile = async (file: BiboFile): Promise<boolean> => {
    const result = await this.act<{ deleted: string[] }>("file.delete", { id: file.id, version: file.version }, this.get().view === "notes" ? "notes" : "files");
    if (!result) return false;
    const removed = new Set(result.deleted);
    for (const id of removed) this.closedFiles.add(id);
    this.set((current) => {
      const index = current.tabs.indexOf(current.activeFileId ?? "");
      const tabs = current.tabs.filter((id) => !removed.has(id));
      const activeFileId = current.activeFileId && !removed.has(current.activeFileId) ? current.activeFileId : current.tabs.slice(index + 1).find((id) => !removed.has(id)) ?? current.tabs.slice(0, index).reverse().find((id) => !removed.has(id)) ?? null;
      return { tabs, activeFileId, fileDetails: Object.fromEntries(Object.entries(current.fileDetails).filter(([id]) => !removed.has(id))), fileDrafts: Object.fromEntries(Object.entries(current.fileDrafts).filter(([id]) => !removed.has(id))), expandedFolders: Object.fromEntries(Object.entries(current.expandedFolders).filter(([id]) => !removed.has(id))), fileBrowserVisible: tabs.length === 0 || current.fileBrowserVisible, ...(current.workspaceFileId && removed.has(current.workspaceFileId) ? { workspaceOpen: false, workspaceFileId: null } : {}) };
    });
    this.saveLayout();
    const active = this.get().activeFileId;
    if (active && !this.get().fileDetails[active]) await this.openFile(active);
    return true;
  };
}

export const useBiboSpaceStore = create<BiboSpaceOwner>((set, get) => new BiboSpaceOwner(set, get));
