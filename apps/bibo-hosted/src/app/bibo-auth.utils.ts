import { selfHostedLogin, selfHostedUser, type SelfHostedAuth } from "./utils/bibo-self-hosted-auth.utils";

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

export async function currentUser(token: string | null, env: SelfHostedAuth = {}): Promise<BiboUser | null> {
  if (env.BIBO_AUTH_MODE === "self-hosted") return selfHostedUser(token, env);
  if (!token) return null;
  const { status, value } = await platformRequest<{ user: BiboUser }>("/platform/auth/me", token);
  return status === 200 && value.ok ? value.data?.user ?? null : null;
}

export async function isPlatformAdmin(token: string | null, env: SelfHostedAuth = {}): Promise<boolean> {
  if (env.BIBO_AUTH_MODE === "self-hosted") return false;
  if (!token) return false;
  const { status, value } = await platformRequest<unknown>("/platform/admin/overview", token);
  return status === 200 && value.ok;
}

async function identityCache(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const key = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return { cache: await caches.open("bibo-verified-identities"), request: new Request(`https://app.bibo.bot/.internal/identity/${key}`) };
}

function verifiedTokenExpiry(token: string): number {
  try {
    const value = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString()) as { exp?: unknown };
    return typeof value.exp === "number" && Number.isFinite(value.exp) ? value.exp * 1000 : 0;
  } catch { return 0; }
}

export async function sessionUser(token: string | null, env: SelfHostedAuth = {}): Promise<Pick<BiboUser, "id"> | null> {
  if (env.BIBO_AUTH_MODE === "self-hosted") return selfHostedUser(token, env);
  if (!token) return null;
  const entry = await identityCache(token).catch(() => null);
  const cached = await entry?.cache.match(entry.request).catch(() => undefined);
  if (cached) {
    const value = await cached.json().catch(() => null) as { id?: unknown; expiresAt?: unknown } | null;
    if (value && typeof value.id === "string" && typeof value.expiresAt === "number" && value.expiresAt > Date.now()) return { id: value.id };
  }
  const user = await currentUser(token);
  // Read expiry only after the platform verified this exact token; an unverified claim never grants access.
  const expiresAt = Math.min(Date.now() + 30_000, verifiedTokenExpiry(token));
  if (user && entry && expiresAt > Date.now()) {
    await entry.cache.put(entry.request, json({ id: user.id, expiresAt }, 200, {
      "cache-control": `max-age=${Math.floor((expiresAt - Date.now()) / 1000)}`,
    })).catch(() => undefined);
  }
  return user;
}

type BiboAuthEnvironment = SelfHostedAuth & {
  BIBO_MODEL_BUDGET?: { getByName(name: string): { fetch(input: string, init?: RequestInit): Promise<Response> } };
};

async function selfHostedAuthRoute(request: Request, path: string, env: BiboAuthEnvironment): Promise<Response> {
    if (path === "/api/auth/me" && request.method === "GET") {
      const user = await selfHostedUser(cookieToken(request), env);
      return user ? json({ user }) : publicError("请使用部署时设置的邮箱和密码登录。", 401);
    }
    if (path === "/api/auth/logout" && request.method === "POST") return json({ ok: true }, 200, {
      "set-cookie": "bibo_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    });
    if (path !== "/api/auth/login" || request.method !== "POST") return publicError("自部署空间不开放注册，请登录。", 404);
    if (!env.BIBO_MODEL_BUDGET) return publicError("登录服务尚未配置。", 503);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(request.headers.get("cf-connecting-ip") ?? "local"));
    const admission = await env.BIBO_MODEL_BUDGET.getByName("global").fetch("https://bibo.internal/login", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: Buffer.from(digest).toString("hex") }),
    });
    if (!admission.ok) return publicError("登录尝试过于频繁，请稍后重试。", 429);
    const result = await selfHostedLogin(await request.json().catch(() => null), env);
    return result ? json({ user: result.user }, 200, {
      "set-cookie": `bibo_session=${result.token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`,
    }) : publicError("邮箱或密码不正确，或部署账号尚未配置。", 401);
}

export async function authRoute(request: Request, path: string, env: BiboAuthEnvironment = {}): Promise<Response> {
  if (env.BIBO_AUTH_MODE === "self-hosted") return selfHostedAuthRoute(request, path, env);
  const routeMap: Record<string, string> = {
    "/api/auth/send-code": "/platform/auth/register/send-code",
    "/api/auth/register": "/platform/auth/register/complete",
    "/api/auth/login": "/platform/auth/login",
  };
  if (path === "/api/auth/logout" && request.method === "POST") {
    const token = cookieToken(request);
    if (token) {
      const entry = await identityCache(token).catch(() => null);
      await entry?.cache.delete(entry.request).catch(() => undefined);
    }
    return json({ ok: true }, 200, { "set-cookie": "bibo_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0" });
  }
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
