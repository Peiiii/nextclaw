import { DurableObject } from "cloudflare:workers";
import { currentUser, json, publicError } from "./bibo-auth.utils";

const MAX_MODEL_REQUEST_BYTES = 128 * 1024;
const DAILY_MODEL_LIMIT_MESSAGE = "今日试用额度已用完，请明天再试。";
type Budget = { day: string; total: number; users: Record<string, number> };

export function modelError(message: string, status: number): Response {
  return json({ error: { message, type: "bibo_limit_error" } }, status);
}

export class BiboModelBudget extends DurableObject<Env> {
  override async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") return modelError("Not found", 404);
    const path = new URL(request.url).pathname;
    if (path !== "/available" && path !== "/reserve") return modelError("Not found", 404);
    const { userId } = await request.json() as { userId?: unknown };
    if (typeof userId !== "string" || !userId) return modelError("Invalid user", 400);
    const day = new Date().toISOString().slice(0, 10);
    if (path === "/available") {
      const saved = await this.ctx.storage.get<Budget>("budget");
      const budget = saved?.day === day ? saved : { day, total: 0, users: {} };
      return budget.total >= 200 || (budget.users[userId] ?? 0) >= 30
        ? modelError(DAILY_MODEL_LIMIT_MESSAGE, 429) : json({ ok: true });
    }
    const reserved = await this.ctx.storage.transaction(async (storage) => {
      const saved = await storage.get<Budget>("budget");
      const budget = saved?.day === day ? saved : { day, total: 0, users: {} };
      if (budget.total >= 200 || (budget.users[userId] ?? 0) >= 30) return false;
      budget.total += 1;
      budget.users[userId] = (budget.users[userId] ?? 0) + 1;
      await storage.put("budget", budget);
      return true;
    });
    return reserved ? json({ ok: true }) : modelError(DAILY_MODEL_LIMIT_MESSAGE, 429);
  }
}

export async function modelRoute(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return modelError("Not found", 404);
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
  const user = await currentUser(bearer);
  if (!user) return modelError("请先登录。", 401);
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_MODEL_REQUEST_BYTES) return modelError("模型输入过长。", 413);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_MODEL_REQUEST_BYTES) return modelError("模型输入过长。", 413);
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw) as Record<string, unknown>; }
  catch { return modelError("模型请求格式不正确。", 400); }
  if (!body || typeof body !== "object" || !Array.isArray(body.messages) || body.messages.length === 0) return modelError("缺少对话内容。", 400);
  const budget = env.BIBO_MODEL_BUDGET.getByName("global");
  const reservation = await budget.fetch("https://bibo.internal/reserve", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: user.id }),
  });
  if (!reservation.ok) return reservation;
  const upstream = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${env.BIBO_DEEPSEEK_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: "deepseek-flash",
      messages: body.messages,
      ...(Array.isArray(body.tools) ? { tools: body.tools, tool_choice: body.tool_choice ?? "auto" } : {}),
      thinking: { type: "disabled" },
      stream: body.stream === true,
      max_tokens: Math.max(1, Math.min(typeof body.max_tokens === "number" ? body.max_tokens : 2048, 2048)),
    }),
  });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json", "cache-control": "no-store" },
  });
}

export async function checkChatAvailability(env: Env, userId: string): Promise<Response | null> {
  const available = await env.BIBO_MODEL_BUDGET.getByName("global").fetch("https://bibo.internal/available", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId }),
  });
  if (available.status === 429) return publicError(DAILY_MODEL_LIMIT_MESSAGE, 429);
  if (!available.ok) throw new Error(`Bibo model budget check failed: ${available.status}`);
  return null;
}
