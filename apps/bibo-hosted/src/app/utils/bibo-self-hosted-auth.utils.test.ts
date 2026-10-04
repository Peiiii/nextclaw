import assert from "node:assert/strict";
import { test } from "node:test";
import { currentUser, authRoute, isPlatformAdmin } from "@/app/bibo-auth.utils";
import { selfHostedLogin, selfHostedUser, type SelfHostedAuth } from "./bibo-self-hosted-auth.utils";

const env: SelfHostedAuth = { BIBO_AUTH_MODE: "self-hosted", BIBO_OWNER_EMAIL: "owner@example.com", BIBO_OWNER_PASSWORD: "synthetic-test-password-only-32chars" };
test("self-hosted credentials sign a bounded session; tampering, expiry and password rotation revoke it", async () => {
  const now = Date.now();
  const login = await selfHostedLogin({ email: env.BIBO_OWNER_EMAIL, password: env.BIBO_OWNER_PASSWORD }, env, now);
  assert.ok(login);
  assert.equal((await selfHostedUser(login.token, env, now))?.id, "owner");
  assert.equal(await selfHostedUser(login.token + "x", env, now), null);
  assert.equal(await selfHostedUser(login.token, env, now + 86_401_000), null);
  assert.equal(await selfHostedUser(login.token, { ...env, BIBO_OWNER_PASSWORD: "another-synthetic-password-for-tests" }, now), null);
  assert.equal(await selfHostedLogin({ email: env.BIBO_OWNER_EMAIL, password: "incorrect" }, env), null);
  assert.equal(await selfHostedLogin({ email: "other@example.com", password: env.BIBO_OWNER_PASSWORD }, env), null);
  assert.equal(await selfHostedLogin({ email: env.BIBO_OWNER_EMAIL, password: "short" }, { ...env, BIBO_OWNER_PASSWORD: "short" }), null);
});
test("self-hosted HTTP auth has no platform dependency and requires budget admission", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Unexpected platform request"); };
  try {
    const budget = { getByName: () => ({ fetch: async () => Response.json({ ok: true }) }) } as unknown as Env["BIBO_MODEL_BUDGET"];
    const runtime = { ...env, BIBO_MODEL_BUDGET: budget };
    const request = () => new Request("https://bibo.example/api/auth/login", { method: "POST", body: JSON.stringify({ email: env.BIBO_OWNER_EMAIL, password: env.BIBO_OWNER_PASSWORD }) });
    const response = await authRoute(request(), "/api/auth/login", runtime);
    assert.equal(response.status, 200);
    const cookie = response.headers.get("set-cookie")!;
    assert.match(cookie, /HttpOnly; Secure; SameSite=Lax/);
    const token = cookie.match(/bibo_session=([^;]+)/)![1]!;
    assert.equal((await currentUser(token, env))?.id, "owner");
    assert.equal(await isPlatformAdmin(token, env), false);
    const me = await authRoute(new Request("https://bibo.example/api/auth/me", { headers: { cookie } }), "/api/auth/me", runtime);
    assert.equal((await me.json() as { user: { id: string } }).user.id, "owner");
    assert.equal((await authRoute(request(), "/api/auth/login", env)).status, 503);
    const denied = { ...runtime, BIBO_MODEL_BUDGET: { getByName: () => ({ fetch: async () => new Response(null, { status: 429 }) }) } as unknown as Env["BIBO_MODEL_BUDGET"] };
    assert.equal((await authRoute(request(), "/api/auth/login", denied)).status, 429);
    assert.equal((await authRoute(request(), "/api/auth/register", runtime)).status, 404);
    const logout = await authRoute(request(), "/api/auth/logout", runtime);
    assert.match(logout.headers.get("set-cookie")!, /Max-Age=0/);
  } finally { globalThis.fetch = original; }
});
