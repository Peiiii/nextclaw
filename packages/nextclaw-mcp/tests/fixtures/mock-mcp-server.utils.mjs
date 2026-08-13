#!/usr/bin/env node
import http from "node:http";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

const mode = process.argv[2] ?? "stdio";
const requestedPort = Number(process.argv[3] ?? "0");

function createEchoServer(name, echoText = "echo:ok") {
  const server = new McpServer({
    name,
    version: "1.0.0"
  });

  server.registerTool("echo", {
    description: "Returns a stable echo payload"
  }, async () => ({
    content: [
      {
        type: "text",
        text: echoText
      }
    ]
  }));

  return server;
}

async function readJsonBody(req) {
  if (req.method !== "POST" && req.method !== "DELETE") {
    return undefined;
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return undefined;
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function startStdio() {
  const requiresDataDirectory = process.argv[3] === "require-data-dir";
  if (requiresDataDirectory && !process.env.NEXTCLAW_APP_DATA_DIR) {
    throw new Error("NEXTCLAW_APP_DATA_DIR is required");
  }
  const server = createEchoServer(
    "mock-stdio-server",
    requiresDataDirectory ? "data-dir:ok" : "echo:ok",
  );
  const transport = new StdioServerTransport();
  transport.onclose = () => {
    process.exit(0);
  };
  await server.connect(transport);
  console.error("READY stdio");
  await new Promise(() => {});
}

async function startStreamableHttp() {
  const server = createEchoServer("mock-http-server");
  const transports = new Map();
  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (url.pathname !== "/mcp") {
      res.statusCode = 404;
      res.end("not found");
      return;
    }

    const body = await readJsonBody(req);
    if (req.method === "POST" && isInitializeRequest(body)) {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID()
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
      if (transport.sessionId) {
        transports.set(transport.sessionId, transport);
      }
      return;
    }

    const sessionHeader = req.headers["mcp-session-id"];
    const sessionId = Array.isArray(sessionHeader) ? sessionHeader[0] : sessionHeader;
    if (!sessionId) {
      res.statusCode = 400;
      res.end("missing session id");
      return;
    }
    const transport = transports.get(sessionId);
    if (!transport) {
      res.statusCode = 404;
      res.end("unknown session");
      return;
    }
    await transport.handleRequest(req, res, body);
  });

  httpServer.listen(requestedPort, "127.0.0.1", () => {
    const address = httpServer.address();
    const port = typeof address === "object" && address ? address.port : requestedPort;
    console.log(`READY http http://127.0.0.1:${port}/mcp`);
  });

  process.on("SIGTERM", () => httpServer.close(() => process.exit(0)));
  process.on("SIGINT", () => httpServer.close(() => process.exit(0)));
}

async function startSse() {
  const server = createEchoServer("mock-sse-server");
  const transports = new Map();
  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/mcp") {
      const endpoint = `http://${req.headers.host ?? "127.0.0.1"}/messages`;
      const transport = new SSEServerTransport(endpoint, res);
      transports.set(transport.sessionId, transport);
      transport.onclose = () => {
        transports.delete(transport.sessionId);
      };
      await server.connect(transport);
      return;
    }

    if (req.method === "POST" && url.pathname === "/messages") {
      const sessionId = url.searchParams.get("sessionId");
      if (!sessionId) {
        res.statusCode = 400;
        res.end("missing session id");
        return;
      }
      const transport = transports.get(sessionId);
      if (!transport) {
        res.statusCode = 404;
        res.end("unknown session");
        return;
      }
      const body = await readJsonBody(req);
      await transport.handlePostMessage(req, res, body);
      return;
    }

    res.statusCode = 404;
    res.end("not found");
  });

  httpServer.listen(requestedPort, "127.0.0.1", () => {
    const address = httpServer.address();
    const port = typeof address === "object" && address ? address.port : requestedPort;
    console.log(`READY sse http://127.0.0.1:${port}/mcp`);
  });

  process.on("SIGTERM", () => httpServer.close(() => process.exit(0)));
  process.on("SIGINT", () => httpServer.close(() => process.exit(0)));
}

const runners = {
  stdio: startStdio,
  http: startStreamableHttp,
  sse: startSse
};

const runner = runners[mode];
if (!runner) {
  console.error(`Unsupported mode: ${mode}`);
  process.exit(1);
}

runner().catch((error) => {
  console.error(error);
  process.exit(1);
});
