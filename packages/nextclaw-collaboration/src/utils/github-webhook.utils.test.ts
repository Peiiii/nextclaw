import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { githubWebhookEvent } from "./github-webhook.utils.js";

const connection = { source: "https://github.com/owner/repo", options: { repository: "owner/repo", label: "agent:test" } };
const secret = "a".repeat(64);
const payload = {
  action: "created", repository: { full_name: "owner/repo" },
  issue: { number: 64, body: "context", state: "open", updated_at: "2026-09-13T09:00:00Z", user: { login: "owner" }, labels: [{ name: "agent:test" }] },
  comment: { id: 123, body: "你好", updated_at: "2026-09-13T09:00:01Z", user: { login: "owner" } },
};
const signed = (data: unknown) => {
  const body = JSON.stringify(data);
  return [body, `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`] as const;
};
describe("GitHub webhook boundary", () => {
  it("uses polling identity so redelivery reaches existing deduplication", () => {
    const event = githubWebhookEvent(connection, ...signed(payload), secret);
    expect(event).toMatchObject({ id: "comment:123:2026-09-13T09:00:01Z", subject: "64", data: { body: "你好", invited: true, change: "message", actor: { account: "owner" } } });
    expect(githubWebhookEvent(connection, ...signed(payload), secret)).toEqual(event);
  });
  it("rejects tampering and other repositories even with a valid signature", () => {
    const [body, signature] = signed(payload);
    expect(() => githubWebhookEvent(connection, body + " ", signature, secret)).toThrow("signature");
    expect(() => githubWebhookEvent(connection, body, "", secret)).toThrow("signature");
    expect(() => githubWebhookEvent(connection, ...signed({ ...payload, repository: { full_name: "other/repo" } }), secret)).toThrow("repository");
  });
  it("handles invitations and closure but ignores deletions and pull requests", () => {
    expect(githubWebhookEvent(connection, ...signed({ ...payload, comment: undefined, action: "labeled" }), secret)?.data.change).toBe("context");
    expect(githubWebhookEvent(connection, ...signed({ ...payload, comment: undefined, action: "closed", issue: { ...payload.issue, state: "closed" } }), secret)?.data.change).toBe("closed");
    expect(githubWebhookEvent(connection, ...signed({ ...payload, action: "deleted" }), secret)).toBeUndefined();
    expect(githubWebhookEvent(connection, ...signed({ ...payload, issue: { ...payload.issue, pull_request: {} } }), secret)).toBeUndefined();
  });
});
