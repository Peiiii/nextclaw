import type { Context } from "hono";
import { requireAdminUser } from "@/services/platform.service";
import type { Env } from "@/types/platform";
import { apiError } from "@/utils/platform.utils";

/** Platform owns administrator identity; the feedback service owns review state. */
export async function adminSupportHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  const admin = await requireAdminUser(c);
  if (!admin.ok) return admin.response;
  const id = c.req.param("id");
  const path = "/api/support/review" + (id ? "/" + encodeURIComponent(id) : "");
  return proxyAdministratorRequest(c, admin.user, path, !id ? ["bucket", "q", "page", "pageSize"] : []);
}

export async function adminDiscussionHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  const admin = await requireAdminUser(c);
  if (!admin.ok) return admin.response;
  const id = c.req.param("id");
  const path = "/api/discussions/admin" + (id ? "/" + encodeURIComponent(id) : "") + (c.req.path.endsWith("/posts") ? "/posts" : "");
  return proxyAdministratorRequest(c, admin.user, path, !id ? ["space", "before"] : []);
}

async function proxyAdministratorRequest(
  c: Context<{ Bindings: Env }>,
  admin: { id: string; username: string | null; email: string },
  path: string,
  queryKeys: string[],
): Promise<Response> {
  const token = c.env.SUPPORT_ADMIN_TOKEN;
  if (!token || token.length < 32) return apiError(c, 503, "SUPPORT_UNAVAILABLE", "反馈服务尚未连接。");
  const base = new URL(c.env.SUPPORT_API_BASE ?? "https://roadmap.nextclaw.io");
  if (base.protocol !== "https:" && !(base.protocol === "http:" && ["127.0.0.1", "localhost"].includes(base.hostname))) {
    return apiError(c, 503, "SUPPORT_UNAVAILABLE", "反馈服务地址配置不正确。");
  }
  const url = new URL(path, base);
  if (queryKeys.length) {
    const filters = Object.entries(c.req.query()).filter(([key]) => queryKeys.includes(key));
    url.search = new URLSearchParams(filters).toString();
  }
  let body: string | undefined;
  if (c.req.method === "POST") {
    try {
      const input = await c.req.json<Record<string, unknown>>();
      body = JSON.stringify({ ...input, _actor: { id: admin.id, displayName: admin.username || admin.email } });
    } catch {
      return apiError(c, 400, "INVALID_REQUEST", "请求格式不正确。");
    }
  }
  if (body && new TextEncoder().encode(body).length > 16000) return apiError(c, 413, "PAYLOAD_TOO_LARGE", "评审内容过长。");
  try {
    const response = await fetch(url, {
      method: c.req.method, body, redirect: "manual", signal: AbortSignal.timeout(15000),
      headers: { authorization: "Bearer " + token, "content-type": "application/json" }
    });
    if (response.status >= 300 && response.status < 400) return apiError(c, 503, "SUPPORT_UNAVAILABLE", "反馈服务不接受重定向。");
    return new Response(await response.text(), {
      status: response.status, headers: { "content-type": "application/json", "cache-control": "no-store" }
    });
  } catch (error) {
    console.error("Support upstream request failed", error instanceof Error ? error.message : "Unknown transport error");
    return apiError(c, 503, "SUPPORT_UNAVAILABLE", "反馈服务暂时不可用，请稍后重试。");
  }
}
