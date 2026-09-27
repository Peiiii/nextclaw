import { createBrowserRouter, matchRoutes } from "react-router";
import { createElement } from "react";
import type { BiboView } from "@/features/space";

const views: BiboView[] = ["overview", "chat", "inbox", "calendar", "tasks", "notes", "files"];
const routes = [
  { index: true, handle: { view: "overview" as BiboView }, lazy: async () => ({ Component: (await import("@/features/chat")).SpacePage }) },
  ...views.filter((view) => view !== "overview").map((view) => ({
    path: view === "chat" ? "chat/:sessionId?" : view,
    handle: { view },
    lazy: async () => ({ Component: (await import("@/features/chat"))[view === "chat" ? "ChatPage" : "SpacePage"] }),
  })),
  { path: "*", handle: { view: "overview" as BiboView, notFound: true }, lazy: async () => ({ Component: (await import("@/features/chat")).NotFoundPage }) },
];
let router: ReturnType<typeof createBrowserRouter>;

export function initializeWorkspaceRouter() {
  router = createBrowserRouter([{
    path: "/",
    hydrateFallbackElement: createElement("div", { role: "status", className: "workspace-loading" }, "正在打开…"),
    lazy: async () => ({ Component: (await import("@/features/chat")).BiboApp }),
    children: routes,
  }]);
  return router;
}

export function readWorkspaceRoute(pathname = router.state.location.pathname) {
  const match = matchRoutes(routes.map((route) => ({ path: route.path ?? "", handle: route.handle })), pathname)?.at(-1);
  return { view: match?.route.handle?.view ?? "overview", sessionId: match?.params.sessionId ?? null,
    notFound: match?.route.handle && "notFound" in match.route.handle ? true : false };
}

export function workspaceHref(view: BiboView, sessionId: string | null = null): string {
  if (view === "overview") return "/";
  return `/${view}${view === "chat" && sessionId ? `/${encodeURIComponent(sessionId)}` : ""}`;
}

export function navigateWorkspace(view: BiboView): void {
  const target = workspaceHref(view);
  if (target !== `${router.state.location.pathname}${router.state.location.search}`) void router.navigate(target);
}

export function navigateConversation(sessionId: string | null, replace = false): void {
  const target = workspaceHref("chat", sessionId);
  if (target !== `${router.state.location.pathname}${router.state.location.search}`) void router.navigate(target, { replace });
}

export function replaceConversationContext(sessionId: string | null): void {
  const { view } = readWorkspaceRoute();
  if (view !== "chat") return;
  const target = workspaceHref(view, sessionId);
  if (target !== `${router.state.location.pathname}${router.state.location.search}`) void router.navigate(target, { replace: true });
}
