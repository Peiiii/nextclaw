import { parseSystemObjectReferenceUri } from "@nextclaw/shared";
import { BiboClient, type BiboFile, type BiboFileDetail } from "@nextclaw/bibo-client";
import { navigateConversation, navigateWorkspace } from "@/app/workspace-router";
import { useBiboSpaceStore } from "@/features/space/stores/bibo-space.store";

class WorkspaceResourceManager {
  private readonly client = new BiboClient();
  private request = 0;

  href = (uri: string): string | null => {
    const object = parseSystemObjectReferenceUri(uri);
    if (object) {
      const module = ({ file: "files", task: "tasks", event: "calendar", "inbox-delivery": "inbox", "chat-session": "chat" } as Record<string, string>)[object.objectType];
      return module ? `/${module}/${encodeURIComponent(object.objectId)}` : uri;
    }
    if (uri.startsWith("nextclaw://")) {
      try {
        const url = new URL(uri);
        if (url.host === "file" && url.pathname.startsWith("/workspace/")) return this.pathHref(decodeURIComponent(url.pathname.slice(11)));
      } catch { return uri; }
      return uri;
    }
    if (/^\/(files|tasks|calendar|inbox|chat)\/[^/]+$/.test(uri)) return uri;
    if (!uri.includes(":") && !uri.startsWith("//") && /\.[a-z0-9]+(?:#.*)?$/i.test(uri)) return this.pathHref(uri.replace(/^\.\//, "").replace(/^\/workspace\//, ""));
    return null;
  };

  private pathHref = (path: string): string | null => {
    if (!path || path.startsWith("/") || path.includes("\\") || path.split("/").some((part) => !part || part === "." || part === "..")) return null;
    return `/files/path/${encodeURIComponent(path)}`;
  };

  private findFile = async (path: string, current: () => boolean): Promise<string | null> => {
    let cursor: string | null = null;
    do {
      const page: { items: BiboFile[]; nextCursor: string | null } = await this.client.space("file.list", { query: path, limit: 100, ...(cursor ? { cursor } : {}) });
      if (!current()) return null;
      const id = page.items.find((file) => file.path === path && file.kind !== "folder")?.id;
      if (id) return id;
      cursor = page.nextCursor;
    } while (cursor);
    return null;
  };

  private openFile = async (href: string, view: string, current: () => boolean): Promise<void> => {
    if (view === "chat") useBiboSpaceStore.setState({ workspaceOpen: true, workspaceResolving: true, error: "" });
    const path = /^\/files\/path\/(.+)$/.exec(href);
    const id = path ? await this.findFile(decodeURIComponent(path[1]!), current) : decodeURIComponent(href.slice(7));
    if (!current()) return;
    if (!id) throw new Error("找不到引用的文件。");
    const file = await this.client.space<BiboFileDetail>("file.get", { id });
    if (!current() || view === "chat" && !useBiboSpaceStore.getState().workspaceOpen) return;
    if (file.kind === "folder") throw new Error("此引用指向目录，请在文件模块查看。");
    const state = useBiboSpaceStore.getState();
    if (state.view === "chat") return state.openWorkspace(id, file);
    if (state.view !== "files" && state.view !== "notes") navigateWorkspace("files");
    await state.openFile(id, file);
  };

  open = async (href: string): Promise<void> => {
    const token = ++this.request;
    const account = useBiboSpaceStore.getState().accountId;
    const view = useBiboSpaceStore.getState().view;
    const active = () => token === this.request && account === useBiboSpaceStore.getState().accountId;
    const current = () => active() && view === useBiboSpaceStore.getState().view;
    const fileRequest = href.startsWith("/files/");
    try {
      const object = /^\/(files|tasks|calendar|inbox|chat)\/([^/]+)$/.exec(href);
      if (fileRequest) { await this.openFile(href, view, current); return; }
      if (!object) throw new Error("此资源暂不支持打开。");
      const id = decodeURIComponent(object[2]!);
      const state = useBiboSpaceStore.getState();
      if (object[1] === "chat") navigateConversation(id);
      else if (object[1] === "tasks") { navigateWorkspace("tasks"); state.selectTask(id); }
      else if (object[1] === "calendar") { navigateWorkspace("calendar"); state.selectEvent(id); }
      else if (object[1] === "inbox") { navigateWorkspace("inbox"); state.selectInbox(id); }
    } catch (error) {
      if (current() && (!fileRequest || view !== "chat" || useBiboSpaceStore.getState().workspaceOpen)) useBiboSpaceStore.setState({ ...(view === "chat" ? { workspaceOpen: true } : {}), error: error instanceof Error ? error.message : "暂时无法打开资源。" });
    } finally {
      if (active()) useBiboSpaceStore.setState({ workspaceResolving: false });
    }
  };

  intercept = (event: MouseEvent): void => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>(".ui-markdown a[href]") : null;
    const href = anchor?.getAttribute("href");
    if (!href || !(href.startsWith("nextclaw://") || /^\/(files|tasks|calendar|inbox|chat)\//.test(href))) return;
    event.preventDefault();
    void this.open(href);
  };
}

export const workspaceResources = new WorkspaceResourceManager();
