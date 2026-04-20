import {
  DEFAULT_DASHSCOPE_API_BASE,
  DEFAULT_GLOBAL_FREE_USD_LIMIT,
  DEFAULT_REQUEST_FLAT_USD_PER_REQUEST,
  DEFAULT_TOKEN_TTL_SECONDS,
  DEFAULT_USER_FREE_USD_LIMIT,
  MIN_AUTH_SECRET_LENGTH,
  PASSWORD_HASH_ITERATIONS,
  type ChatCompletionRequest,
  type CursorPayload,
  type Env,
  type SessionTokenPayload,
  type SupportedModelSpec,
  type UsageCounters,
  type UserRow
} from "../types/platform";

export async function readJson(c: { req: { json: <T>() => Promise<T> } }): Promise<Record<string, unknown>> {
  try {
    const parsed = await c.req.json<Record<string, unknown>>();
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function readUnknown(payload: Record<string, unknown>, key: string): unknown {
  return payload[key];
}

export function readString(payload: Record<string, unknown>, key: string): string {
  const raw = payload[key];
  return typeof raw === "string" ? raw : "";
}

export function readNumber(payload: Record<string, unknown>, key: string): number {
  const raw = payload[key];
  return typeof raw === "number" ? raw : Number.NaN;
}

export function isStrongPassword(value: string): boolean {
  return value.trim().length >= 8;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
export function optionalTrimmedString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parsePositiveUsd(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return roundUsd(value);
}

export function parseBoundedInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

export function readClientIp(cfConnectingIp: string | undefined, forwardedFor: string | undefined): string | null {
  if (cfConnectingIp && cfConnectingIp.trim().length > 0) {
    return cfConnectingIp.trim();
  }
  if (!forwardedFor) {
    return null;
  }
  const first = forwardedFor.split(",")[0]?.trim();
  return first && first.length > 0 ? first : null;
}

export function parseIsoDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function paginateRows<T extends { created_at: string; id: string }>(
  rows: T[],
  limit: number
): { items: T[]; nextCursor: string | null; hasMore: boolean } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: hasMore && last
      ? encodeCursorToken({ createdAt: last.created_at, id: last.id })
      : null,
    hasMore
  };
}

export function encodeCursorToken(payload: CursorPayload): string {
  const raw = JSON.stringify(payload);
  return encodeBase64Url(new TextEncoder().encode(raw));
}

export function decodeCursorToken(raw: string | undefined): CursorPayload | null {
  if (!raw || raw.trim().length === 0) {
    return null;
  }
  try {
    const decoded = new TextDecoder().decode(decodeBase64Url(raw.trim()));
    const parsed = JSON.parse(decoded) as CursorPayload;
    if (!parsed || typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") {
      return null;
    }
    if (parsed.createdAt.length === 0 || parsed.id.length === 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function normalizeIdempotencyKey(raw: string | undefined): string | null {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > 128) {
    return null;
  }
  return trimmed.replace(/[^a-zA-Z0-9._:-]/g, "_");
}

export async function issueSessionToken(env: Env, user: UserRow): Promise<string> {
  const secret = readAuthSecret(env);
  if (!secret) {
    throw new Error("AUTH_TOKEN_SECRET is required");
  }
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionTokenPayload = {
    sub: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    iat: now,
    exp: now + DEFAULT_TOKEN_TTL_SECONDS
  };
  return await signSessionToken(payload, secret);
}

export function readAuthSecret(env: Env): string | null {
  const secret = env.AUTH_TOKEN_SECRET?.trim();
  if (!secret) {
    return null;
  }
  if (secret.length < MIN_AUTH_SECRET_LENGTH) {
    return null;
  }
  return secret;
}

export async function signSessionToken(payload: SessionTokenPayload, secret: string): Promise<string> {
  const payloadEncoded = encodeBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await signHmacSha256(payloadEncoded, secret);
  return `nca.${payloadEncoded}.${signature}`;
}

export async function verifySessionToken(token: string, secret: string): Promise<SessionTokenPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "nca" || !parts[1] || !parts[2]) {
    return null;
  }

  const payloadEncoded = parts[1];
  const signature = parts[2];

  const expectedSignature = await signHmacSha256(payloadEncoded, secret);
  if (!timingSafeEqual(signature, expectedSignature)) {
    return null;
  }

  let payload: SessionTokenPayload;
  try {
    const decoded = decodeBase64Url(payloadEncoded);
    payload = JSON.parse(new TextDecoder().decode(decoded)) as SessionTokenPayload;
  } catch {
    return null;
  }

  if (!payload.sub || !payload.email || !payload.role || !payload.exp) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    return null;
  }

  return payload;
}

export async function hashPassword(password: string): Promise<{ salt: string; hash: string }> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const derived = await derivePasswordHash(password, saltBytes);
  return {
    salt: encodeBase64Url(saltBytes),
    hash: encodeBase64Url(derived)
  };
}

export async function verifyPassword(password: string, saltEncoded: string, expectedHashEncoded: string): Promise<boolean> {
  const salt = decodeBase64Url(saltEncoded);
  const derived = await derivePasswordHash(password, salt);
  const actualHashEncoded = encodeBase64Url(derived);
  return timingSafeEqual(actualHashEncoded, expectedHashEncoded);
}

export function getDashscopeApiBase(env: Env): string {
  return normalizeNonEmptyString(env.DASHSCOPE_API_BASE) ?? DEFAULT_DASHSCOPE_API_BASE;
}

export function getGlobalFreeLimit(env: Env): number {
  return parseNonNegativeNumber(env.GLOBAL_FREE_USD_LIMIT, DEFAULT_GLOBAL_FREE_USD_LIMIT);
}

export function getDefaultUserFreeLimit(env: Env): number {
  return parseNonNegativeNumber(env.DEFAULT_USER_FREE_USD_LIMIT, DEFAULT_USER_FREE_USD_LIMIT);
}

export function getRequestFlatUsdPerRequest(env: Env): number {
  return parseNonNegativeNumber(env.REQUEST_FLAT_USD_PER_REQUEST, DEFAULT_REQUEST_FLAT_USD_PER_REQUEST);
}

export function extractUsageCounters(payload: Record<string, unknown>, fallback: UsageCounters): UsageCounters {
  if (!isRecord(payload.usage)) {
    return fallback;
  }

  return {
    promptTokens: normalizeNonNegativeInteger(payload.usage.prompt_tokens),
    completionTokens: normalizeNonNegativeInteger(payload.usage.completion_tokens)
  };
}

export function estimateUsage(messages: Array<Record<string, unknown>>, completionTokens: number): UsageCounters {
  const serialized = JSON.stringify(messages);
  const promptTokens = Math.max(1, Math.ceil(serialized.length / 4));
  return {
    promptTokens,
    completionTokens
  };
}

export function resolveMaxCompletionTokens(body: ChatCompletionRequest): number {
  const direct = normalizeNonNegativeInteger(body.max_tokens);
  if (direct > 0) {
    return Math.min(8192, direct);
  }
  const modern = normalizeNonNegativeInteger(body.max_completion_tokens);
  if (modern > 0) {
    return Math.min(8192, modern);
  }
  return 1024;
}

export function calculateCost(modelSpec: SupportedModelSpec, usage: UsageCounters): number {
  return (usage.promptTokens / 1_000_000) * modelSpec.inputUsdPer1M +
    (usage.completionTokens / 1_000_000) * modelSpec.outputUsdPer1M;
}

export function parseBearerToken(header: string | undefined): string | null {
  if (!header) {
    return null;
  }
  const parts = header.trim().split(/\s+/);
  const scheme = parts[0];
  const rawToken = parts[1];
  if (parts.length !== 2 || !scheme || !rawToken || scheme.toLowerCase() !== "bearer") {
    return null;
  }
  const token = rawToken.trim();
  return token.length > 0 ? token : null;
}

export function randomOpaqueToken(): string {
  const buffer = crypto.getRandomValues(new Uint8Array(24));
  return encodeBase64Url(buffer);
}

export function parseCookieHeader(rawHeader: string | null | undefined): Record<string, string> {
  if (!rawHeader) {
    return {};
  }
  const cookies: Record<string, string> = {};
  for (const chunk of rawHeader.split(";")) {
    const [rawKey, ...rawValue] = chunk.split("=");
    const key = rawKey?.trim();
    if (!key) {
      continue;
    }
    cookies[key] = decodeURIComponent(rawValue.join("=").trim());
  }
  return cookies;
}

export function buildCookie(params: {
  name: string;
  value: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
  maxAgeSeconds?: number;
}): string {
  const { name, value, path, secure, httpOnly, sameSite, maxAgeSeconds } = params;
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path ?? "/"}`];
  if (httpOnly !== false) {
    parts.push("HttpOnly");
  }
  if (sameSite) {
    parts.push(`SameSite=${sameSite}`);
  } else {
    parts.push("SameSite=Lax");
  }
  if (secure !== false) {
    parts.push("Secure");
  }
  if (typeof maxAgeSeconds === "number") {
    parts.push(`Max-Age=${Math.max(0, Math.trunc(maxAgeSeconds))}`);
  }
  return parts.join("; ");
}

export function normalizeNonNegativeInteger(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    return 0;
  }
  return Math.floor(raw);
}

export function normalizeNonEmptyString(raw: string | undefined): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function withTrailingSlash(base: string): string {
  return base.endsWith("/") ? base : `${base}/`;
}

export function sanitizeResponseHeaders(headers: Headers): Headers {
  const next = new Headers(headers);
  next.delete("content-length");
  return next;
}

export function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function openaiError(c: { json: (body: unknown, status?: number) => Response }, status: number, message: string, code: string): Response {
  const type = code === "insufficient_quota"
    ? "insufficient_quota"
    : status >= 500
      ? "server_error"
      : "invalid_request_error";
  return c.json(
    {
      error: {
        message,
        type,
        param: null,
        code
      }
    },
    status
  );
}

export function apiError(
  c: { json: (body: unknown, status?: number) => Response },
  status: number,
  code: string,
  message: string
): Response {
  return c.json(
    {
      ok: false,
      error: {
        code,
        message
      }
    },
    status
  );
}

export function jsonErrorResponse(status: number, code: string, message: string): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      error: {
        code,
        message
      }
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}

export function openaiLikeUnauthorized(message: string): Response {
  return jsonErrorResponse(401, "UNAUTHORIZED", message);
}

export function openaiLikeUnavailable(message: string): Response {
  return jsonErrorResponse(503, "SERVICE_UNAVAILABLE", message);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function signHmacSha256(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return encodeBase64Url(new Uint8Array(signature));
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(raw: string): Uint8Array {
  const base64 = raw.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) {
    return false;
  }
  let diff = 0;
  for (let index = 0; index < aBytes.length; index += 1) {
    diff |= (aBytes[index] ?? 0) ^ (bBytes[index] ?? 0);
  }
  return diff === 0;
}

async function derivePasswordHash(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: PASSWORD_HASH_ITERATIONS
    },
    keyMaterial,
    256
  );
  return new Uint8Array(bits);
}

function parseNonNegativeNumber(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}
