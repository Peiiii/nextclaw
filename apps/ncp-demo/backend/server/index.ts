import { serve } from "@hono/node-server";
import { createAgentClientFromServer } from "@nextclaw/ncp-toolkit";
import { mountNcpHttpAgentRoutes } from "@nextclaw/ncp-http-agent-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createDemoBackend } from "./backend.js";

const port = parsePort(process.env.NCP_DEMO_PORT, 3197);
const host = "127.0.0.1";

const { backend, llmMode } = createDemoBackend();
const agentClient = createAgentClientFromServer(backend);

const app = new Hono();
app.use("*", cors());

app.get("/health", (c) => {
  return c.json({ ok: true, llmMode });
});

app.get("/demo/sessions", async (c) => {
  const sessions = await backend.listSessions();
  return c.json(sessions);
});

app.get("/demo/sessions/:sessionId/messages", async (c) => {
  const sessionId = c.req.param("sessionId");
  const messages = await backend.listSessionMessages(sessionId);
  return c.json(messages);
});

app.delete("/demo/sessions/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  await backend.deleteSession(sessionId);
  return c.json({ ok: true });
});

mountNcpHttpAgentRoutes(app, {
  agentClientEndpoint: agentClient,
  streamProvider: backend,
});

await backend.start();

serve(
  {
    fetch: app.fetch,
    port,
    hostname: host,
  },
  (info) => {
    console.log(`[ncp-demo] server listening at http://${info.address}:${info.port} (llm=${llmMode})`);
  },
);

const shutdown = async () => {
  await backend.stop();
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
