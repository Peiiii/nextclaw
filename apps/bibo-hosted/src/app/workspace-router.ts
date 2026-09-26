import { createBrowserRouter, matchRoutes } from "react-router";
import type { BiboView } from "@/features/space";

const views: BiboView[] = ["overview", "chat", "inbox", "calendar", "tasks", "notes", "files"];
const routes = [
  { index: true, handle: { view: "overview" as BiboView } },
  ...views.filter((view) => view !== "overview").map((view) => ({
    path: view === "chat" ? "chat/:sessionId?" : view,
    handle: { view },
  })),
  { path: "*", handle: { view: "overview" as BiboView, notFound: true } },
];
let router: ReturnType<typeof createBrowserRouter>;

export function initializeWorkspaceRouter() {
  router = createBrowserRouter([{
    path: "/",
    lazy: async () => ({ Component: (await import("@/features/chat")).BiboApp }),
    children: routes,
  }]);
  return router;
}

export function readWorkspaceRoute(pathname = router.state.location.pathname) {
  const match = matchRoutes(routes, pathname)?.at(-1);
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
