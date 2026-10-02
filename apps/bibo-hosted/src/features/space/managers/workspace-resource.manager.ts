import { parseSystemObjectReferenceUri } from "@nextclaw/shared";
import { BiboClient, type BiboFile } from "@nextclaw/bibo-client";
import { filePathHref, navigateResource, readWorkspaceRoute, resourceHref } from "@/app/workspace-router";
import { useBiboSpaceStore, type BiboView } from "@/features/space/stores/bibo-space.store";
import { biboCopy } from "@/shared/configs/bibo-copy.config";
import { writeWorkspaceLayout } from "@/features/space/utils/workspace-layout.utils";

class WorkspaceResourceManager {
  private readonly client = new BiboClient();
  private request = 0;
  private routeKey = "";

  activateRoute = (route: ReturnType<typeof readWorkspaceRoute>): void => {
    const state = useBiboSpaceStore.getState();
    const key = JSON.stringify([state.accountId, route]);
    if (key === this.routeKey) return;
    this.routeKey = key;
    this.request++;
    useBiboSpaceStore.setState({ error: "", fileOpenError: null });
    const viewChanged = state.view !== route.view;
    state.activateView(route.view, false);
    state.selectTask(state.accountId && route.view === "tasks" ? route.resourceId : null, undefined, true);
    state.selectEvent(state.accountId && route.view === "calendar" ? route.resourceId : null, undefined, true);
    state.inboxReader.select(state.accountId && route.view === "inbox" ? route.resourceId : null, true);
    if (route.view === "files" || route.view === "notes") useBiboSpaceStore.setState({ activeFileId: route.resourceId, fileRoutePath: route.filePath, fileBrowserVisible: !route.resourceId && !route.filePath, fileOpenError: null });
    if (!state.accountId || route.notFound) return;
    if ((viewChanged || !state.readStatus[route.view]) && !(route.view === "calendar" && route.resourceId)) void state.load(route.view);
    if (route.view === "files" || route.view === "notes") {
      if (route.resourceId) void state.openFile(route.resourceId, undefined, true, true);
      else if (route.filePath) void this.openFile(filePathHref(route.filePath), route.view,
        () => this.routeKey === key && state.accountId === useBiboSpaceStore.getState().accountId).catch(error => {
          if (this.routeKey === key) useBiboSpaceStore.setState({ error: error instanceof Error ? error.message : "暂时无法打开资源。" });
        });
    } else if (route.view === "chat" && state.workspaceOpen && state.workspaceFileId && !state.fileDetails[state.workspaceFileId]) {
      void state.openWorkspace(state.workspaceFileId);
    }
  };

  retryRoute = (): void => {
    this.routeKey = "";
    this.activateRoute(readWorkspaceRoute());
  };

  showFileBrowser = (): void => {
    const state = useBiboSpaceStore.getState();
    navigateResource(`/${state.view}`);
    useBiboSpaceStore.setState({ fileBrowserVisible: true, activeFileId: null, fileRoutePath: null });
  };

  showWorkspace = (): void => {
    useBiboSpaceStore.setState({ workspaceOpen: true });
    const state = useBiboSpaceStore.getState();
    writeWorkspaceLayout(state);
    void state.load("files");
    if (state.workspaceFileId && !state.fileDetails[state.workspaceFileId]) void state.openWorkspace(state.workspaceFileId);
  };

  private syncFileSelection = (): void => {
    const state = useBiboSpaceStore.getState();
    if (state.view === "files" || state.view === "notes") {
      navigateResource(state.activeFileId ? resourceHref(state.view, state.activeFileId) : `/${state.view}`);
    } else if (state.view === "chat" && state.workspaceOpen && state.workspaceFileId && !state.fileDetails[state.workspaceFileId]) void state.openWorkspace(state.workspaceFileId);
  };

  closeFile = (id: string, discard = false): void => {
    useBiboSpaceStore.getState().closeFile(id, discard);
    if (!useBiboSpaceStore.getState().tabs.includes(id)) this.syncFileSelection();
  };

  moveFile = async (file: BiboFile, path: string): Promise<boolean> => {
    const state = useBiboSpaceStore.getState();
    const moved = await state.moveFile(file, path);
    if (moved && state.accountId === useBiboSpaceStore.getState().accountId) this.syncFileSelection();
    return moved;
  };

  deleteFile = async (file: BiboFile): Promise<boolean> => {
    const state = useBiboSpaceStore.getState();
    const deleted = await state.deleteFile(file);
    if (deleted && state.accountId === useBiboSpaceStore.getState().accountId) this.syncFileSelection();
    return deleted;
  };

  href = (uri: string): string | null => {
    const object = parseSystemObjectReferenceUri(uri);
    if (object) {
      const module = ({ file: "files", task: "tasks", event: "calendar", "inbox-delivery": "inbox", "chat-session": "chat" } as Record<string, BiboView>)[object.objectType];
      return module ? resourceHref(module, object.objectId) : uri;
    }
    if (uri.startsWith("nextclaw://")) {
      try {
        const url = new URL(uri);
        if (url.host === "file" && url.pathname.startsWith("/workspace/")) return this.pathHref(decodeURIComponent(url.pathname.slice(11)));
      } catch { return uri; }
      return uri;
    }
    if (/^file:/i.test(uri)) {
      try {
        const url = new URL(uri);
        if (url.protocol !== "file:" || url.hostname && url.hostname.toLowerCase() !== "localhost") return null;
        return this.pathHref(decodeURIComponent(url.pathname));
      } catch { return null; }
    }
    if (/^\/(files|notes|tasks|calendar|inbox|chat)\/.+$/.test(uri) || uri.startsWith("/files?path=")) return uri;
    if (/^[a-z][a-z\d+.-]*:/i.test(uri) || uri.startsWith("//")) return null;
    try {
      const path = decodeURIComponent(uri.split(/[?#]/, 1)[0] ?? "").replace(/^\.\//, "").replace(/^\/workspace\//, "");
      return this.pathHref(path);
    } catch { return null; }
  };

  private pathHref = (path: string): string | null => {
    if (!path || path.startsWith("//") || path.includes("\\") || path.split("/").some((part, index) => !part && index !== 0 || part === "." || part === "..")) return null;
    return filePathHref(path);
  };

  private openFile = async (href: string, view: string, current: () => boolean, preview?: boolean): Promise<void> => {
    if (view === "chat") useBiboSpaceStore.setState({ workspaceOpen: true, workspaceResolving: true, error: "" });
    const url = new URL(href, "https://app.bibo.bot");
    const route = readWorkspaceRoute(url.pathname, url.search);
    const file = await this.client.readFile(route.filePath ? { path: route.filePath } : { id: route.resourceId! });
    if (!current() || view === "chat" && !useBiboSpaceStore.getState().workspaceOpen) return;
    if (file.kind === "folder") throw new Error(biboCopy.folderReference);
    const state = useBiboSpaceStore.getState();
    if (state.view === "chat") return state.openWorkspace(file.id, file, preview);
    await state.openFile(file.id, file, true, true);
  };

  open = async (href: string, preview?: boolean, isCurrent?: () => boolean): Promise<void> => {
    const token = ++this.request;
    const account = useBiboSpaceStore.getState().accountId;
    const view = useBiboSpaceStore.getState().view;
    if (!/^\/(files|notes|tasks|calendar|inbox|chat)\//.test(href) && !href.startsWith("/files?path=")) {
      useBiboSpaceStore.setState({ ...(view === "chat" ? { workspaceOpen: true } : {}), workspaceResolving: false, error: "此资源暂不支持打开。" });
      return;
    }
    if (view !== "chat" || !(href.startsWith("/files/") || href.startsWith("/files?path="))) {
      navigateResource(href);
      return;
    }
    const active = () => token === this.request && account === useBiboSpaceStore.getState().accountId;
    const current = () => active() && view === useBiboSpaceStore.getState().view && (isCurrent?.() ?? true);
    try {
      await this.openFile(href, view, current, preview);
    } catch (error) {
      if (current() && useBiboSpaceStore.getState().workspaceOpen) useBiboSpaceStore.setState({ error: error instanceof Error ? error.message : "暂时无法打开资源。" });
    } finally {
      if (active()) useBiboSpaceStore.setState({ workspaceResolving: false });
    }
  };

  intercept = (event: MouseEvent): void => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>(".ui-markdown a[href]") : null;
    const href = anchor?.getAttribute("href");
    if (!href || !(href.startsWith("nextclaw://") || /^\/(files|notes|tasks|calendar|inbox|chat)\//.test(href) || href.startsWith("/files?path="))) return;
    event.preventDefault();
    void this.open(href);
  };
}

export const workspaceResources = new WorkspaceResourceManager();
