const MAX_SEARCH_BYTES = 8192;
const DAILY_SEARCH_LIMIT = 1000;
const MONTHLY_SEARCH_LIMIT = 10_000;
const USER_DAILY_SEARCH_LIMIT = 100;

type SearchBudget = { month: string; monthlyTotal: number; day: string; dailyTotal: number; users: Record<string, number> };
type SearchEnv = Pick<Env, "BIBO_EXA_API_KEY" | "BIBO_MODEL_BUDGET">;
type SearchUser = { id: string };

function searchJson(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "cache-control": "no-store" } });
}

function searchError(message: string, status: number): Response {
  return searchJson({ message }, status);
}

export async function reserveBiboSearch(storage: DurableObjectStorage, userId: string, now = new Date()): Promise<Response> {
  const day = now.toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  const error = await storage.transaction(async (transaction) => {
    const saved = await transaction.get<SearchBudget>("search-budget");
    const budget: SearchBudget = {
      month, monthlyTotal: saved?.month === month ? saved.monthlyTotal : 0,
      day, dailyTotal: saved?.day === day ? saved.dailyTotal : 0,
      users: saved?.day === day ? saved.users : {},
    };
    if (budget.monthlyTotal >= MONTHLY_SEARCH_LIMIT) return "本月网页搜索额度已用完，请下月再试。";
    if (budget.dailyTotal >= DAILY_SEARCH_LIMIT) return "今日网页搜索服务额度已用完，请明天再试。";
    if ((budget.users[userId] ?? 0) >= USER_DAILY_SEARCH_LIMIT) return "你今日的网页搜索额度已用完，请明天再试。";
    budget.monthlyTotal += 1;
    budget.dailyTotal += 1;
    budget.users[userId] = (budget.users[userId] ?? 0) + 1;
    await transaction.put("search-budget", budget);
    return null;
  });
  return error ? searchError(error, 429) : searchJson({ ok: true });
}

export async function biboSearchRoute(
  request: Request, env: SearchEnv, authenticate: (token: string | null) => Promise<SearchUser | null>,
): Promise<Response> {
  if (request.method !== "POST") return searchError("Not found", 404);
  try {
    const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
    const user = await authenticate(token);
    if (!user) return searchError("请先登录后使用网页搜索。", 401);
    if (!env.BIBO_EXA_API_KEY) return searchError("网页搜索尚未配置，请稍后再试。", 503);
    if (Number(request.headers.get("content-length") ?? 0) > MAX_SEARCH_BYTES) return searchError("搜索请求过长。", 413);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_SEARCH_BYTES) return searchError("搜索请求过长。", 413);
    let body: { query?: unknown; numResults?: unknown };
    try { body = JSON.parse(raw) as typeof body; }
    catch { return searchError("搜索请求格式不正确。", 400); }
    if (!body || typeof body.query !== "string" || !body.query.trim() || body.query.length > 2000) {
      return searchError("搜索词需要包含 1 到 2000 字。", 400);
    }
    const count = body.numResults ?? 10;
    if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > 10) return searchError("每次搜索支持 1 到 10 个结果。", 400);
    const reservation = await env.BIBO_MODEL_BUDGET.getByName("global").fetch("https://bibo.internal/search", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: user.id }),
    });
    if (!reservation.ok) return reservation;
    const upstream = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: { authorization: `Bearer ${env.BIBO_EXA_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ query: body.query.trim(), type: "auto", contents: { highlights: true }, ...(count === 10 ? {} : { numResults: count }) }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!upstream.ok) {
      console.warn("bibo-search-upstream-failed", upstream.status);
      return searchError(upstream.status === 429 ? "搜索服务暂时繁忙或额度不足，请稍后再试。" : "搜索服务暂时不可用，请稍后再试。", upstream.status === 429 ? 429 : 502);
    }
    const result = await upstream.json() as { requestId?: string; results?: unknown[] };
    if (!result || !Array.isArray(result.results)) return searchError("搜索服务没有返回有效结果，请重试。", 502);
    console.info("bibo-search-completed", { requestId: result.requestId, resultCount: result.results.length });
    return searchJson(result);
  } catch {
    return searchError("网页搜索超时或暂时不可用，请稍后再试。", 503);
  }
}
