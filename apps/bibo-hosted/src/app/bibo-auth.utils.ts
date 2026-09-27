const PLATFORM = "https://ai-gateway-api.nextclaw.io";

type PlatformResponse<T> = { ok: boolean; data?: T; error?: { message?: string } };
export type BiboUser = { id: string; email: string; freeRemainingUsd: number; paidBalanceUsd: number };

export function json(value: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export function publicError(message: string, status: number): Response {
  return json({ error: message }, status);
}

export function cookieToken(request: Request): string | null {
  const cookie = request.headers.get("cookie")?.match(/(?:^|;\s*)bibo_session=([^;]+)/);
  return cookie ? decodeURIComponent(cookie[1] ?? "") : null;
}

async function platformRequest<T>(path: string, token: string | null, body?: unknown): Promise<{ status: number; value: PlatformResponse<T> }> {
  const response = await fetch(`${PLATFORM}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let value: PlatformResponse<T>;
  try { value = await response.json(); } catch { value = { ok: false, error: { message: "Account service unavailable" } }; }
  return { status: response.status, value };
}

export async function currentUser(token: string | null): Promise<BiboUser | null> {
  if (!token) return null;
  const { status, value } = await platformRequest<{ user: BiboUser }>("/platform/auth/me", token);
  return status === 200 && value.ok ? value.data?.user ?? null : null;
}

export async function authRoute(request: Request, path: string): Promise<Response> {
  const routeMap: Record<string, string> = {
    "/api/auth/send-code": "/platform/auth/register/send-code",
    "/api/auth/register": "/platform/auth/register/complete",
    "/api/auth/login": "/platform/auth/login",
  };
  if (path === "/api/auth/logout" && request.method === "POST") return json({ ok: true }, 200, { "set-cookie": "bibo_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0" });
  if (path === "/api/auth/me") {
    if (request.method !== "GET") return publicError("Not found", 404);
    const user = await currentUser(cookieToken(request));
    return user ? json({ user }) : publicError("请先登录。", 401);
  }
  const upstream = routeMap[path];
  if (!upstream || request.method !== "POST") return publicError("Not found", 404);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return publicError("请求格式不正确。", 400);
  const { status, value } = await platformRequest<{ token?: string; user?: BiboUser }>(upstream, null, body);
  if (!value.ok) return publicError(value.error?.message ?? "账号服务暂时不可用。", status);
  const token = value.data?.token;
  if (token) return json({ user: value.data?.user }, status, { "set-cookie": `bibo_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000` });
  return json(value.data, status);
}
