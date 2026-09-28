import { DurableObject } from "cloudflare:workers";
import { currentUser, json, publicError } from "./bibo-auth.utils";
import { reserveBiboSearch } from "@/features/search";
import { logDiagnostic, readModelRequest, readTrace, runFailure } from "./diagnostics/bibo-diagnostics.utils";
import { forwardBiboModel } from "./services/bibo-model-transport.service";

const DAILY_MODEL_LIMIT = 2000;
const USER_DAILY_MODEL_LIMIT = 250;
const DAILY_MODEL_LIMIT_MESSAGE = "今日试用额度已用完，请明天再试。";
type Budget = { day: string; total: number; users: Record<string, number> };

export function modelError(message: string, status: number): Response {
  return json({ error: { message, type: "bibo_limit_error" } }, status);
}

export class BiboModelBudget extends DurableObject<Env> {
  override async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") return modelError("Not found", 404);
    const path = new URL(request.url).pathname;
    if (path !== "/available" && path !== "/reserve" && path !== "/search") return modelError("Not found", 404);
    const { userId } = await request.json() as { userId?: unknown };
    if (typeof userId !== "string" || !userId) return modelError("Invalid user", 400);
    if (path === "/search") return reserveBiboSearch(this.ctx.storage, userId);
    const day = new Date().toISOString().slice(0, 10);
    if (path === "/available") {
      const saved = await this.ctx.storage.get<Budget>("budget");
      const budget = saved?.day === day ? saved : { day, total: 0, users: {} };
      return budget.total >= DAILY_MODEL_LIMIT || (budget.users[userId] ?? 0) >= USER_DAILY_MODEL_LIMIT
        ? modelError(DAILY_MODEL_LIMIT_MESSAGE, 429) : json({ ok: true });
    }
    const reserved = await this.ctx.storage.transaction(async (storage) => {
      const saved = await storage.get<Budget>("budget");
      const budget = saved?.day === day ? saved : { day, total: 0, users: {} };
      if (budget.total >= DAILY_MODEL_LIMIT || (budget.users[userId] ?? 0) >= USER_DAILY_MODEL_LIMIT) return false;
      budget.total += 1;
      budget.users[userId] = (budget.users[userId] ?? 0) + 1;
      await storage.put("budget", budget);
      return true;
    });
    return reserved ? json({ ok: true }) : modelError(DAILY_MODEL_LIMIT_MESSAGE, 429);
  }
}

export async function modelRoute(request: Request, env: Env): Promise<Response> {
  const trace = readTrace(request.headers);
  const started = Date.now();
  const reject = (message: string, status: number, code: string) => {
    logDiagnostic("model", "model.rejected", { ...trace, status, errorCode: code, durationMs: Date.now() - started }, "warn");
    return modelError(message, status);
  };
  if (request.method !== "POST") return modelError("Not found", 404);
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
  const user = await currentUser(bearer);
  if (!user) return reject("请先登录。", 401, "MODEL_UNAUTHORIZED");
  let raw: string;
  let bytes: number;
  try { ({ raw, bytes } = await readModelRequest(request)); }
  catch (error) { const failure = runFailure(error); return reject(failure.message, failure.status, failure.code); }
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw) as Record<string, unknown>; }
  catch { return reject("模型请求格式不正确。", 400, "MODEL_INVALID_JSON"); }
  if (!body || typeof body !== "object" || !Array.isArray(body.messages) || body.messages.length === 0) return reject("缺少对话内容。", 400, "MODEL_INVALID_MESSAGES");
  logDiagnostic("model", "model.started", { ...trace, requestBytes: bytes, messageCount: body.messages.length, toolCount: Array.isArray(body.tools) ? body.tools.length : 0 });
  return forwardBiboModel(body, env, user.id, trace, started);
}

export async function checkChatAvailability(env: Env, userId: string): Promise<Response | null> {
  const available = await env.BIBO_MODEL_BUDGET.getByName("global").fetch("https://bibo.internal/available", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId }),
  });
  if (available.status === 429) return publicError(DAILY_MODEL_LIMIT_MESSAGE, 429);
  if (!available.ok) throw new Error(`Bibo model budget check failed: ${available.status}`);
  return null;
}
