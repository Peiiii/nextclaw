import { createBrowserRouter } from "react-router";
import type { BiboView } from "@/features/space";

const views: BiboView[] = ["overview", "chat", "inbox", "calendar", "tasks", "notes", "files"];
let router: ReturnType<typeof createBrowserRouter>;

export function initializeWorkspaceRouter() {
  router = createBrowserRouter([{
    path: "/",
    lazy: async () => ({ Component: (await import("@/features/chat")).BiboApp }),
  }]);
  return router;
}

export function readWorkspaceRoute(search = router.state.location.search) {
  const params = new URLSearchParams(search);
  const candidate = params.get("view") as BiboView;
  return { view: views.includes(candidate) ? candidate : "overview" as BiboView, sessionId: params.get("session") };
}

export function workspaceHref(view: BiboView, sessionId: string | null = null): string {
  const params = new URLSearchParams();
  if (view !== "overview") params.set("view", view);
  if (sessionId) params.set("session", sessionId);
  return `/${params.size ? `?${params}` : ""}`;
}

export function navigateWorkspace(view: BiboView): void {
  const { sessionId } = readWorkspaceRoute();
  const target = workspaceHref(view, sessionId);
  if (target !== `${router.state.location.pathname}${router.state.location.search}`) void router.navigate(target);
}

export function navigateConversation(sessionId: string | null, replace = false): void {
  const target = workspaceHref("chat", sessionId);
  if (target !== `${router.state.location.pathname}${router.state.location.search}`) void router.navigate(target, { replace });
}

export function replaceConversationContext(sessionId: string | null): void {
  const { view } = readWorkspaceRoute();
  const target = workspaceHref(view, sessionId);
  if (target !== `${router.state.location.pathname}${router.state.location.search}`) void router.navigate(target, { replace: true });
}
