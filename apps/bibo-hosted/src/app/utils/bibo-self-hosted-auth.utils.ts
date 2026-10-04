import type { BiboUser } from "@/app/bibo-auth.utils";

export type SelfHostedAuth = { BIBO_AUTH_MODE?: "self-hosted"; BIBO_OWNER_EMAIL?: string; BIBO_OWNER_PASSWORD?: string };
const lifetime = 86_400;
const encode = (value: Uint8Array | string): string => Buffer.from(value).toString("base64url");
const configured = (env: SelfHostedAuth): boolean => Boolean(env.BIBO_OWNER_EMAIL?.includes("@") &&
  env.BIBO_OWNER_PASSWORD && env.BIBO_OWNER_PASSWORD.length >= 16);
const user = (env: SelfHostedAuth): BiboUser => ({ id: "owner", email: env.BIBO_OWNER_EMAIL!, freeRemainingUsd: 0, paidBalanceUsd: 0 });
const key = (env: SelfHostedAuth) => crypto.subtle.importKey("raw", new TextEncoder().encode(env.BIBO_OWNER_PASSWORD),
  { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

export async function selfHostedUser(token: string | null, env: SelfHostedAuth, now = Date.now()): Promise<BiboUser | null> {
  if (!token || !configured(env)) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payload, signature] = parts;
    if (!await crypto.subtle.verify("HMAC", await key(env), Buffer.from(signature!, "base64url"), new TextEncoder().encode(payload))) return null;
    const value = JSON.parse(Buffer.from(payload!, "base64url").toString()) as { email?: unknown; exp?: unknown };
    if (value.email !== env.BIBO_OWNER_EMAIL || typeof value.exp !== "number" || value.exp <= now / 1000 || value.exp > now / 1000 + lifetime) return null;
    return user(env);
  } catch { return null; }
}

export async function selfHostedLogin(input: unknown, env: SelfHostedAuth, now = Date.now()): Promise<{ token: string; user: BiboUser } | null> {
  if (!configured(env) || !input || typeof input !== "object") return null;
  const value = input as { email?: unknown; password?: unknown };
  if (value.email !== env.BIBO_OWNER_EMAIL || typeof value.password !== "string" || value.password.length > 1024) return null;
  const digest = async (password: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password)));
  const [provided, expected] = await Promise.all([digest(value.password), digest(env.BIBO_OWNER_PASSWORD!)]);
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) mismatch |= provided[i]! ^ expected[i]!;
  if (mismatch) return null;
  const payload = encode(JSON.stringify({ email: env.BIBO_OWNER_EMAIL, exp: Math.floor(now / 1000) + lifetime }));
  const signature = encode(new Uint8Array(await crypto.subtle.sign("HMAC", await key(env), new TextEncoder().encode(payload))));
  return { token: `${payload}.${signature}`, user: user(env) };
}
