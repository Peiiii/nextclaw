import { parseSystemObjectReferenceUri } from "@nextclaw/shared";
import { BiboClient } from "@nextclaw/bibo-client";
import { navigateConversation, navigateResource, navigateWorkspace } from "@/app/workspace-router";
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
    if (/^file:/i.test(uri)) {
      try {
        const url = new URL(uri);
        if (url.protocol !== "file:" || url.hostname && url.hostname.toLowerCase() !== "localhost") return null;
        return this.pathHref(decodeURIComponent(url.pathname));
      } catch { return null; }
    }
    if (/^\/(files|tasks|calendar|inbox|chat)\/[^/]+$/.test(uri)) return uri;
    if (/^[a-z][a-z\d+.-]*:/i.test(uri) || uri.startsWith("//")) return null;
    try {
      const path = decodeURIComponent(uri.split(/[?#]/, 1)[0] ?? "").replace(/^\.\//, "").replace(/^\/workspace\//, "");
      return this.pathHref(path);
    } catch { return null; }
  };

  private pathHref = (path: string): string | null => {
    if (!path || path.startsWith("//") || path.includes("\\") || path.split("/").some((part, index) => !part && index !== 0 || part === "." || part === "..")) return null;
    return `/files/path/${encodeURIComponent(path)}`;
  };

  private openFile = async (href: string, view: string, current: () => boolean, preview?: boolean): Promise<void> => {
    if (view === "chat") useBiboSpaceStore.setState({ workspaceOpen: true, workspaceResolving: true, error: "" });
    if (view !== "chat" && view !== "files" && view !== "notes") { navigateResource(href); return; }
    const path = /^\/files\/path\/(.+)$/.exec(href);
    const file = await this.client.readFile(path ? { path: decodeURIComponent(path[1]!) } : { id: decodeURIComponent(href.slice(7)) });
    if (!current() || view === "chat" && !useBiboSpaceStore.getState().workspaceOpen) return;
    if (file.kind === "folder") throw new Error("此引用指向目录，请在文件模块查看。");
    const state = useBiboSpaceStore.getState();
    if (state.view === "chat") return state.openWorkspace(file.id, file, preview);
    await state.openFile(file.id, file);
  };

  open = async (href: string, preview?: boolean, isCurrent?: () => boolean): Promise<void> => {
    const token = ++this.request;
    const account = useBiboSpaceStore.getState().accountId;
    const view = useBiboSpaceStore.getState().view;
    const active = () => token === this.request && account === useBiboSpaceStore.getState().accountId;
    const current = () => active() && view === useBiboSpaceStore.getState().view && (isCurrent?.() ?? true);
    const fileRequest = href.startsWith("/files/");
    try {
      const object = /^\/(files|tasks|calendar|inbox|chat)\/([^/]+)$/.exec(href);
      if (fileRequest) { await this.openFile(href, view, current, preview); return; }
      if (!object) throw new Error("此资源暂不支持打开。");
      const id = decodeURIComponent(object[2]!);
      const state = useBiboSpaceStore.getState();
      if (object[1] === "chat") navigateConversation(id);
      else if (object[1] === "tasks") { navigateWorkspace("tasks"); state.selectTask(id); }
      else if (object[1] === "calendar") { navigateWorkspace("calendar"); state.selectEvent(id); }
      else if (object[1] === "inbox") { navigateWorkspace("inbox"); state.inboxReader.select(id); }
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
