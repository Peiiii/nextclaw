import type { Context } from "hono";
import { requireAdminUser } from "@/services/platform.service";
import type { Env } from "@/types/platform";
import { apiError } from "@/utils/platform.utils";

/** Platform owns administrator identity; the feedback service owns review state. */
export async function adminSupportHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  const admin = await requireAdminUser(c);
  if (!admin.ok) return admin.response;
  const token = c.env.SUPPORT_ADMIN_TOKEN;
  if (!token || token.length < 32) return apiError(c, 503, "SUPPORT_UNAVAILABLE", "反馈服务尚未连接。");
  const base = new URL(c.env.SUPPORT_API_BASE ?? "https://roadmap.nextclaw.io");
  if (base.protocol !== "https:" && !(base.protocol === "http:" && ["127.0.0.1", "localhost"].includes(base.hostname))) {
    return apiError(c, 503, "SUPPORT_UNAVAILABLE", "反馈服务地址配置不正确。");
  }
  const id = c.req.param("id");
  const url = new URL("/api/support/review" + (id ? "/" + encodeURIComponent(id) : ""), base);
  if (!id) for (const key of ["bucket", "q", "page", "pageSize"]) {
    const value = c.req.query(key);
    if (value !== undefined) url.searchParams.set(key, value);
  }
  const body = c.req.method === "POST" ? await c.req.text() : undefined;
  if (body && new TextEncoder().encode(body).length > 16000) return apiError(c, 413, "PAYLOAD_TOO_LARGE", "评审内容过长。");
  try {
    const response = await fetch(url, {
      method: c.req.method, body, redirect: "error", signal: AbortSignal.timeout(15000),
      headers: { authorization: "Bearer " + token, "content-type": "application/json" }
    });
    return new Response(await response.text(), {
      status: response.status, headers: { "content-type": "application/json", "cache-control": "no-store" }
    });
  } catch {
    return apiError(c, 503, "SUPPORT_UNAVAILABLE", "反馈服务暂时不可用，请稍后重试。");
  }
}
