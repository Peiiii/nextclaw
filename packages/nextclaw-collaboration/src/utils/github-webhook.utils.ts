import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { EventSource, EnvHttpProxyAgent } from "undici";
import type { CollaborationEvent, Connection } from "../types/collaboration.types.js";
import type { CollaborationStore } from "../stores/collaboration.store.js";
import type { CollaborationService } from "../services/collaboration.service.js";

type GitHubPayload = {
  action?: string;
  repository?: { full_name: string };
  issue?: { number: number; body: string | null; updated_at: string; state: string;
    user: { login: string }; labels: Array<{ name: string }>; pull_request?: unknown };
  comment?: { id: number; body: string; updated_at: string; user: { login: string } };
};

/** Verify the exact forwarded body before interpreting any platform data. */
export function githubWebhookEvent(connection: Pick<Connection, "source" | "options">, body: string, signature: string, secret: string): CollaborationEvent | undefined {
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(body).digest("hex")}`);
  const supplied = Buffer.from(signature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
    throw new Error("Invalid GitHub webhook signature");
  const payload = JSON.parse(body) as GitHubPayload;
  if (payload.repository?.full_name.toLowerCase() !== connection.options.repository.toLowerCase())
    throw new Error("GitHub webhook repository mismatch");
  const { issue, comment, action } = payload;
  if (!issue || issue.pull_request) return;
  if (comment ? !["created", "edited"].includes(action || "")
    : !["opened", "edited", "labeled", "unlabeled", "closed", "reopened"].includes(action || "")) return;
  const change = comment ? "message" : issue.state === "closed" ? "closed" : "context";
  const time = comment?.updated_at || issue.updated_at;
  return {
    specversion: "1.0", source: connection.source, subject: String(issue.number),
    type: `github.${change}`, time,
    id: comment ? `comment:${comment.id}:${time}` : `issue:${issue.number}:${time}`,
    data: {
      change, resourceId: String(comment?.id || issue.number),
      body: (comment || issue).body || "", actor: { account: (comment || issue).user.login },
      invited: issue.labels.some(label => label.name === (connection.options.label || "agent:mozhao")),
    },
  };
}

/** One outbound SSE connection; lifetime belongs to the collaboration host. */
function startGitHubWebhook(connection: Connection, store: CollaborationStore, service: CollaborationService): () => Promise<void> {
  const secret = readFileSync(connection.options.webhookSecretFile, "utf8").trim();
  if (secret.length < 32) throw new Error("Webhook secret must contain at least 32 characters");
  const dispatcher = new EnvHttpProxyAgent();
  const relay = new EventSource(connection.options.webhookRelayUrl, { node: { dispatcher, reconnectionTime: 5000 } });
  const status = (state: string, error?: string) => store.put("webhook", connection.id, {
    connectionId: connection.id, state, at: new Date().toISOString(), error,
  });
  status("connecting");
  relay.onopen = () => status("connected");
  relay.onerror = () => status("reconnecting", "Webhook relay disconnected; reconnecting automatically");
  relay.onmessage = (message) => {
    try {
      if (String(message.data).length > 2_000_000) throw new Error("Webhook payload too large");
      const forwarded = JSON.parse(String(message.data));
      if (!forwarded.body) return;
      const current = store.get<Connection>("connection", connection.id);
      if (!current?.enabled || current.options.webhookRelayUrl !== connection.options.webhookRelayUrl) return;
      const event = githubWebhookEvent(current, JSON.stringify(forwarded.body), forwarded["x-hub-signature-256"] || "", secret);
      if (event) store.transaction(() => service.ingest(current, event));
      status("connected");
    } catch {
      status("rejected", "Webhook signature, repository or payload validation failed");
    }
  };
  return async () => { relay.close(); status("stopped"); await dispatcher.close(); };
}

export function startGitHubWebhooks(store: CollaborationStore, service: CollaborationService): () => Promise<void> {
  const close: Array<() => Promise<void>> = [];
  try {
    for (const connection of store.list<Connection>("connection")) {
      if (connection.enabled && connection.adapter === "github" && connection.options.webhookRelayUrl)
        close.push(startGitHubWebhook(connection, store, service));
    }
  } catch (error) {
    void Promise.allSettled(close.map(stop => stop()));
    throw error;
  }
  return async () => { await Promise.allSettled(close.map(stop => stop())); };
}
