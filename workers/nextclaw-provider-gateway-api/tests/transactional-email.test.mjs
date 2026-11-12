import assert from "node:assert/strict";
import test from "node:test";
import { sendTransactionalEmail } from "../dist/utils/transactional-email.utils.js";

test("same provider owner preserves platform payload and restricts Bibo to the configured sender address", async (t) => {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(url, "https://api.resend.com/emails");
    assert.equal(init.headers.Authorization, "Bearer fixture-mail-key");
    requests.push(JSON.parse(init.body));
    return new Response("{}", { status: 200 });
  });
  const env = { RESEND_API_KEY: "fixture-mail-key", PLATFORM_AUTH_EMAIL_FROM: "NextClaw <no-reply@mail.nextclaw.io>" };
  const input = { to: "test@example.test", subject: "Verify email", text: "Fixture code", html: "<p>Fixture code</p>" };
  await sendTransactionalEmail(env, input);
  assert.deepEqual(requests[0], { from: env.PLATFORM_AUTH_EMAIL_FROM, to: [input.to], subject: input.subject, html: input.html, text: input.text });
  await sendTransactionalEmail(env, { ...input, senderName: "Bibo" });
  assert.equal(requests[1].from, "Bibo <no-reply@mail.nextclaw.io>");
  await assert.rejects(sendTransactionalEmail(env, { ...input, senderName: "Bibo\r\nInjected" }), { code: "INVALID_SENDER" });
  await assert.rejects(sendTransactionalEmail(env, { ...input, to: "bad" }), { code: "INVALID_EMAIL" });
  await assert.rejects(sendTransactionalEmail({}, input), { code: "EMAIL_PROVIDER_NOT_CONFIGURED" });
});

test("provider errors do not expose raw provider responses", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("provider-private-diagnostics", { status: 429 }));
  await assert.rejects(sendTransactionalEmail({ RESEND_API_KEY: "fixture", PLATFORM_AUTH_EMAIL_FROM: "mail@example.test" },
    { to: "test@example.test", subject: "Test", text: "text", html: "<p>text</p>" }), (error) => error.code === "EMAIL_DELIVERY_FAILED" && !error.message.includes("provider-private"));
});
