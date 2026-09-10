import { parseSystemObjectReferenceUri } from "@nextclaw/shared";
import { nextclawClient } from "@/shared/lib/api";
import { toast } from "sonner";
import { t } from "@/shared/lib/i18n";
import { GLOBAL_WORKBENCH_SURFACE } from "@/shared/components/workbench/types/workbench-surface.types";
import { useChatThreadStore } from "@/features/chat";
import type { ChatThreadManager } from "@/features/chat";
import type { AppPresenter } from "@/app/presenters/app.presenter";
import { useDocBrowserStore } from "@/shared/components/doc-browser/stores/doc-browser.store";
import { useFloatingSessionStore } from "@/features/chat";
import { sessionSurfaceManager } from "@/features/chat";
import {
  buildSessionPath,
  parseSessionKeyFromPanelUrl,
  parseSessionKeyFromRoute,
} from "@/features/chat";
import { createChatUiResourceReferenceFromTab } from "@/features/right-panel-resources/utils/right-panel-resource-uri.utils";
import {
  pageResourceFromTab,
  pageResourceFromTarget,
  pageResourceMainPath,
} from "@/features/right-panel-resources/utils/page-resource-identity.utils";
import { usePageNavigationStore } from "@/features/right-panel-resources/stores/page-navigation.store";
import { createWorkspaceFileViewerTab } from "@/features/chat";
import {
  resolveFileResourceTarget,
  createWorkspaceFilePanelTarget,
  readWorkspaceFilePanelView,
} from "@/features/chat";
import type { DocBrowserTab } from "@/shared/components/doc-browser/types/doc-browser.types";
import type {
  PageOpenLocation,
  PageResource,
} from "@/features/right-panel-resources/types/page-resource.types";

export function pageResourceTab(page: PageResource): DocBrowserTab {
  return {
    ...page.target,
    id: page.uri,
    currentUrl: page.target.url,
    history: [page.target.url],
    historyIndex: 0,
    navVersion: 0,
  };
}

/** One opening and reference policy shared by menus, navigation entries and links. */
export class PageResourceManager {
  private readonly remembered = new Map<string, PageResource>();
  private workspace?: ChatThreadManager;
  constructor(private readonly app: AppPresenter) {}
  bindWorkspace = (owner: ChatThreadManager): void => {
    this.workspace = owner;
  };

  remember = (page: PageResource): void => {
    this.remembered.delete(page.uri);
    this.remembered.set(page.uri, page);
    while (this.remembered.size > 100)
      this.remembered.delete(this.remembered.keys().next().value!);
  };

  resolve = (
    uri: string,
    context?: { workingDir?: string | null; sessionKey?: string | null },
  ): PageResource | null => {
    if (!/^(nextclaw:\/\/|https?:\/\/)/i.test(uri)) return null;
    if (uri.startsWith("nextclaw://file/")) {
      try {
        const target = resolveFileResourceTarget(uri, context);
        return target ? pageResourceFromTarget(target) : null;
      } catch {
        return null;
      }
    }
    const saved =
      this.remembered.get(uri) ??
      usePageNavigationStore.getState().pinned.find((page) => page.uri === uri);
    if (saved) return saved;
    const tab = useDocBrowserStore
      .getState()
      .snapshot.tabs.find(
        (item) => (item.resourceUri ?? item.currentUrl) === uri,
      );
    if (tab) return pageResourceFromTab(tab);
    try {
      if (uri.startsWith("nextclaw://page?")) {
        const path = new URL(uri).searchParams.get("path");
        if (
          !path?.startsWith("/") ||
          path.startsWith("//") ||
          path.startsWith("/resource") ||
          path.includes("\\")
        )
          return null;
        return {
          uri,
          title: path,
          mainPath: path,
          target: {
            kind: "route",
            title: path,
            url: path,
            resourceUri: uri,
            historyPolicy: "none",
          },
        };
      }
      if (uri.startsWith("nextclaw://workspace?")) {
        const params = new URL(uri).searchParams;
        const kind = params.get("page");
        if (
          ![
            "overview",
            "child-sessions",
            "project-files",
            "cron",
            "continuous-attention",
          ].includes(kind ?? "")
        )
          return null;
        return {
          uri,
          title: kind!,
          target: {
            kind: "workspace",
            title: kind!,
            url: uri,
            resourceUri: uri,
            historyPolicy: "none",
          },
        };
      }
      if (uri.startsWith("nextclaw://workspace-file?")) {
        const params = new URL(uri).searchParams;
        const file = useChatThreadStore
          .getState()
          .snapshot.workspaceFileTabs.find(
            (item) => item.key === params.get("key"),
          );
        if (file)
          return pageResourceFromTarget(
            createWorkspaceFilePanelTarget(file, {
              workingDir: params.get("base") || null,
              projectRoot: null,
            }),
          );
      }
      const target = this.app.rightPanelResourceRouteResolver.resolve(uri);
      if (uri.startsWith("nextclaw://") && target.kind === "content")
        return null;
      return pageResourceFromTarget(target);
    } catch {
      return null;
    }
  };

  pin = (page: PageResource): void => {
    this.remember(page);
    usePageNavigationStore.setState(({ pinned }) => ({
      pinned: [...pinned.filter((item) => item.uri !== page.uri), page].slice(
        -64,
      ),
    }));
  };
  unpin = (uri: string): void => {
    usePageNavigationStore.setState(({ pinned }) => ({
      pinned: pinned.filter((page) => page.uri !== uri),
    }));
  };

  open = (
    page: PageResource,
    location: PageOpenLocation,
    navigate: (path: string) => void,
  ): void => {
    this.remember(page);
    if (page.target.kind === "workspace") {
      const params = new URL(page.uri).searchParams;
      const kind = params.get("page") as Parameters<
        ChatThreadManager["openWorkspacePage"]
      >[1];
      const session = params.get("session");
      navigate(session ? buildSessionPath(session) : "/chat");
      this.workspace?.openWorkspacePage(session, kind);
      const parent =
        useChatThreadStore.getState().snapshot.workspacePanelParentKey;
      this.app.workbenchSurfaceManager.place(
        `session-workspace:${parent ?? "draft"}`,
        location === "floating" ? "floating" : "docked",
      );
      if (location === "main")
        this.app.workbenchSurfaceManager.toggleMaximize(`session-workspace:${parent ?? "draft"}`);
      return;
    }
    const sessionKey = parseSessionKeyFromPanelUrl(page.uri);
    if (location === "default") {
      if (
        sessionKey &&
        useFloatingSessionStore.getState().session?.sessionKey === sessionKey
      ) {
        sessionSurfaceManager.restore();
        return;
      }
      if (this.reuseWorkspace(page, sessionKey)) return;
      const existing = useDocBrowserStore.getState().snapshot;
      const tab = existing.tabs.find(
        (item) => (item.resourceUri ?? item.currentUrl) === page.uri,
      );
      if (existing.isOpen && tab) {
        this.app.docBrowserManager.openTarget(page.target, { newTab: true });
        this.app.workbenchSurfaceManager.restore(GLOBAL_WORKBENCH_SURFACE);
        return;
      }
    }
    if (
      location === "main" ||
      page.target.kind === "route" ||
      (location === "default" && page.mainPath && page.target.kind !== "panel-app")
    ) {
      navigate(pageResourceMainPath(page));
    } else if (location === "floating" && sessionKey) {
      sessionSurfaceManager.open({ sessionKey, title: page.title });
    } else {
      this.app.docBrowserManager.openTarget(page.target, {
        newTab: true,
        placement: location === "floating" ? "floating" : "docked",
      });
    }
  };

  private reuseWorkspace = (
    page: PageResource,
    sessionKey: string | null,
  ): boolean => {
    const { snapshot } = useChatThreadStore.getState();
    const surface = `session-workspace:${snapshot.workspacePanelParentKey ?? "draft"}`;
    if (
      !this.workspace ||
      snapshot.workspacePanelHidden ||
      !this.app.workbenchSurfaceManager.isVisible(surface)
    )
      return false;
    const file = readWorkspaceFilePanelView(pageResourceTab(page))?.file;
    if (
      file &&
      snapshot.workspaceFileTabs.some((item) => item.key === file.key)
    )
      this.workspace.selectWorkspaceFile(file.key);
    else if (
      sessionKey &&
      snapshot.childSessionTabs.some((item) => item.sessionKey === sessionKey)
    )
      this.workspace.selectChildSessionDetail(sessionKey);
    else return false;
    this.app.workbenchSurfaceManager.restore(surface);
    return true;
  };

  openFileViewer = (
    page: PageResource,
    viewer: "source" | "rendered",
    origin: "main" | "global" | "workspace" | undefined,
    navigate: (path: string) => void,
  ): void => {
    const view = readWorkspaceFilePanelView(pageResourceTab(page));
    if (!view) return;
    const workspace = useChatThreadStore.getState().snapshot;
    if (
      origin !== "main" &&
      origin !== "global" &&
      !workspace.workspacePanelHidden &&
      workspace.workspaceFileTabs.some((file) => file.key === view.file.key) &&
      this.workspace
    ) {
      this.workspace.openWorkspaceFileViewer(view.file.key, viewer);
      return;
    }
    const file = createWorkspaceFileViewerTab(view.file, viewer);
    if (!file) return;
    const next = pageResourceFromTarget(
      createWorkspaceFilePanelTarget(file, view),
    );
    this.remember(next);
    if (origin === "main") {
      navigate(pageResourceMainPath(next));
      return;
    }
    const tab = useDocBrowserStore
      .getState()
      .snapshot.tabs.find((candidate) => candidate.resourceUri === page.uri);
    if (tab) {
      this.app.docBrowserManager.setActiveTab(tab.id);
      this.app.docBrowserManager.openTarget(next.target);
    } else this.open(next, "default", navigate);
  };

  addToChat = (
    page: PageResource,
    pathname: string,
    navigate: (path: string) => void,
  ): void => {
    const isChat = pathname === "/chat" || pathname.startsWith("/chat/");
    const targetSessionKey = isChat
      ? parseSessionKeyFromRoute(pathname.slice("/chat/".length))
      : null;
    if (parseSystemObjectReferenceUri(page.uri)) {
      void nextclawClient.systemObjectReferences
        .resolve(page.uri)
        .then((reference) => {
          this.app.chatComposerIntentManager.requestSystemObjectReference({
            targetSessionKey,
            reference,
          });
          if (!isChat) navigate("/chat");
        })
        .catch(() => toast.error(t("pageUnavailable")));
      return;
    }
    const tab = pageResourceTab(page);
    const file = readWorkspaceFilePanelView(tab);
    if (file) {
      const path =
        file.file.path.startsWith("/") || !file.workingDir
          ? file.file.path
          : `${file.workingDir.replace(/\/$/, "")}/${file.file.path}`;
      this.app.chatComposerIntentManager.requestFileReference({
        targetSessionKey,
        tokenKey: path,
        label: page.title,
      });
    } else {
      const reference = createChatUiResourceReferenceFromTab(tab);
      if (!reference) return;
      this.app.chatComposerIntentManager.requestUiResourceReference({
        targetSessionKey,
        reference,
      });
    }
    if (!isChat) navigate("/chat");
  };
}
