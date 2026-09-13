import { expect, it } from "vitest";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OfficialSource } from "./official-source.service.js";
import { createIdentity, signMessage } from "../utils/identity.utils.js";
import type { Connection } from "../types/collaboration.types.js";

it("adapts official operation IDs and sees signed participant messages omitted by the legacy event audience", async () => {
  const root = mkdtempSync(join(tmpdir(), "official-adapter-"));
  const tokenFile = join(root, "token");
  writeFileSync(tokenFile, "test-participant-token");
  const subject = "test-discussion-subject";
  const posts: Array<{
    id: string;
    body: string;
    author: { id: string };
    createdAt: string;
  }> = [];
  const view = () => ({
    thread: {
      id: subject,
      title: "Test",
      space: "direct",
      openedBy: { id: "user" },
      createdAt: new Date().toISOString(),
    },
    posts,
  });
  const server = createServer(async (req, res) => {
    if (req.headers.authorization !== "Bearer test-participant-token") {
      res.writeHead(401).end();
      return;
    }
    if (req.method === "POST") {
      let input = "";
      for await (const part of req) input += part;
      const data = JSON.parse(input);
      if (!/^[a-zA-Z0-9_-]{16,80}$/.test(data.operationId)) {
        res.writeHead(400).end(JSON.stringify({ ok: false }));
        return;
      }
      if (!posts.some((p) => p.id === data.operationId))
        posts.push({
          id: data.operationId,
          body: data.body,
          author: { id: "nextclaw-discussion-participant" },
          createdAt: new Date().toISOString(),
        });
    }
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        ok: true,
        data: req.url?.includes("/events?")
          ? { items: [], nextCursor: 7 }
          : view(),
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as { port: number };
    const endpoint = `http://127.0.0.1:${address.port}`;
    const agent = createIdentity(root, "test-agent");
    const connection: Connection = {
      id: "official-test",
      adapter: "official",
      source: endpoint,
      account: "nextclaw-discussion-participant",
      agent,
      options: { endpoint, tokenFile },
      trustedAgents: [],
      allowedAccounts: ["user"],
      consumer: { kind: "codex", workspace: root },
      enabled: true,
      since: "1970-01-01T00:00:00Z",
      intervalMs: 30000,
      maxAgentHops: 4,
      maxRunsPerHour: 12,
    };
    const source = new OfficialSource(connection);
    const operation = {
      id: "reply:" + "x".repeat(90),
      subject,
      purpose: "reply" as const,
      body: signMessage(agent, "🤖[墨爪] Test", {
        source: endpoint,
        subject,
        operationId: "reply:" + "x".repeat(90),
        purpose: "reply",
        hop: 1,
      }),
    };
    const id = await source.reply(operation);
    expect(await source.reply(operation)).toBe(id);
    expect(await source.findReply(subject, operation.id)).toBe(id);
    expect(posts).toHaveLength(1);
    const batch = await source.collect("6", "1970-01-01T00:00:00Z", [subject]);
    expect(batch.events.map((e) => e.id)).toEqual([`official-post:${id}`]);
    expect(batch.checkpoint).toBe("7");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(root, { recursive: true, force: true });
  }
});
