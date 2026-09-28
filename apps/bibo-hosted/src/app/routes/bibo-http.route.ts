import { getContainer } from "@cloudflare/containers";
import { authRoute, cookieToken, currentUser, sessionUser, json, publicError } from "@/app/bibo-auth.utils";
import { biboSearchRoute } from "@/features/search";
import { biboAssetsRoute } from "@/features/assets";
import { checkChatAvailability, modelError, modelRoute } from "@/app/bibo-model-gateway.service";
import { errorDetails, logDiagnostic, readTrace, runFailure, traceHeaders, type RunTrace } from "@/app/diagnostics/bibo-diagnostics.utils";

async function createSession(env: Env, userId: string): Promise<Response> {
  const unavailable = await checkChatAvailability(env, userId);
  if (unavailable) return unavailable;
  return await getContainer(env.BIBO_USER, `user:${userId}`).fetch("https://bibo.internal/sessions/new", { method: "POST" });
}

function withAuthTiming(response: Response, authMs: number): Response {
  const headers = new Headers(response.headers);
  headers.append("server-timing", `auth;dur=${authMs.toFixed(1)}`);
  return new Response(response.body, { status: response.status, headers });
}

async function userRoute(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname;
  const token = cookieToken(request);
  const authStarted = performance.now();
  const user = path === "/api/space" || path === "/api/assets" || path.startsWith("/api/assets/") ? await sessionUser(token) : await currentUser(token);
  const authMs = performance.now() - authStarted;
  if (!user || !token) return publicError("请先登录。", 401);
  if (path === "/api/assets" || path.startsWith("/api/assets/")) return biboAssetsRoute(request, env.SNAPSHOTS, user.id);
  const container = getContainer(env.BIBO_USER, `user:${user.id}`);
  if (path === "/api/sessions" && request.method === "GET") return await container.fetch("https://bibo.internal/sessions");
  if (path === "/api/sessions" && request.method === "POST") return await createSession(env, user.id);
  if (path === "/api/sessions/rename" && request.method === "POST") return await container.fetch("https://bibo.internal/sessions/rename", {
    method: "POST", headers: { "content-type": "application/json" }, body: await request.text(),
  });
  if (path === "/api/sessions/delete" && request.method === "POST") return await container.fetch("https://bibo.internal/sessions/delete", {
    method: "POST", headers: { "content-type": "application/json" }, body: await request.text(),
  });
  if (path === "/api/history" && request.method === "GET") return await container.fetch(`https://bibo.internal/history${url.search}`);
  if (path === "/api/chat/availability" && request.method === "GET") return await checkChatAvailability(env, user.id) ?? json({ ok: true });
  if (path === "/api/space" && request.method === "POST") {
    const response = await container.fetch("https://bibo.internal/space", {
      method: "POST", headers: { "content-type": "application/json" }, body: await request.text(),
    });
    return withAuthTiming(response, authMs);
  }
  if (path === "/api/reset" && request.method === "POST") return await container.fetch("https://bibo.internal/reset", { method: "POST" });
  if (path === "/api/cancel" && request.method === "POST") return await container.fetch("https://bibo.internal/cancel", {
    method: "POST", headers: { "content-type": "application/json" }, body: await request.text(),
  });
  if (path === "/api/chat" && request.method === "POST") {
    const body = await request.json() as { message?: unknown; sessionId?: unknown; questionId?: unknown; questionAction?: unknown };
    const trace: RunTrace = { runId: crypto.randomUUID(), ...(typeof body.sessionId === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(body.sessionId) ? { sessionId: body.sessionId } : {}) };
    if (typeof body.message === "string" && body.message.trim()) {
      const unavailable = await checkChatAvailability(env, user.id);
      if (unavailable) { logDiagnostic("worker", "chat.rejected", { ...trace, status: unavailable.status, errorCode: "CHAT_BUDGET_REJECTED" }, "warn"); return unavailable; }
    }
    return await container.fetch("https://bibo.internal/run", {
      method: "POST",
      headers: { "content-type": "application/json", ...traceHeaders(trace), ...(request.headers.get("accept")?.includes("text/event-stream") ? { accept: "text/event-stream" } : {}) },
      body: JSON.stringify({ message: body.message, sessionId: body.sessionId, questionId: body.questionId, questionAction: body.questionAction, token }),
    });
  }
  return publicError("Not found", 404);
}

export const biboFetch = async (request: Request, env: Env): Promise<Response> => {
    const url = new URL(request.url);
    if (url.hostname === "bibo.bot") {
      if (request.method !== "GET" && request.method !== "HEAD") return publicError("Not found", 404);
      const path = url.pathname.replace(/^\/app\/?/, "/");
      return Response.redirect(`https://app.bibo.bot${path}${url.search}`, 308);
    }
    const path = url.pathname;
    if (path.startsWith("/api/")) {
      if (path === "/api/search/exa") return await biboSearchRoute(request, env, currentUser);
      if (path === "/api/model/v1/chat/completions") {
        try { return await modelRoute(request, env); }
        catch (error) {
          logDiagnostic("model", "model.failed", { ...readTrace(request.headers), ...errorDetails(error), errorCode: runFailure(error).code }, "error");
          return modelError("模型服务暂时不可用。", 503);
        }
      }
      if (request.method !== "GET" && request.headers.get("origin") !== url.origin) return publicError("请求来源不正确。", 403);
      try {
        if (path.startsWith("/api/auth/")) return await authRoute(request, path);
        return await userRoute(request, env, url);
      } catch (error) {
        logDiagnostic("worker", "request.failed", { ...readTrace(request.headers), ...errorDetails(error), errorCode: "EDGE_REQUEST_FAILED" }, "error");
        return publicError("Bibo 暂时无法连接，请稍后重试。", 503);
      }
    }
    return await env.ASSETS.fetch(request);
};
