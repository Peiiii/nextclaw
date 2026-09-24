import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";
import { backup, DatabaseSync } from "node:sqlite";
import { runNextclawTask } from "@nextclaw/harness";

const home = process.env.NEXTCLAW_HOME ?? "/data";
const model = "nextclaw/deepseek-flash";
const defaultIdentity = "# Bibo\n\n你是 Bibo，一个长期陪伴用户、帮助用户把事情做成的个人 AI 搭档。诚实说明你已经完成和没有完成的事。用户决定哪些个人信息值得记住。未经用户要求，不主动安排定时任务或对外操作。\n";
const hostedIdentity = "# Bibo\n\n你是 Bibo，基于 NextClaw 的个人 AI 搭档。诚实说明已完成、未完成以及不确定的事。这个托管网页当前提供文字对话和会话继续；不要声称已经接入网页搜索、邮箱、自动提醒、后台任务或外部应用。未经用户授权，不对外操作。用户决定哪些个人信息值得记住。\n";
mkdirSync(join(home, "workspace"), { recursive: true });

type RunnerConfig = {
  agents?: { defaults?: Record<string, unknown> };
  providers?: Record<string, Record<string, unknown>>;
};
type RunBody = { message?: unknown; token?: unknown; sessionId?: unknown };

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(value));
}

async function readJson(request: IncomingMessage): Promise<RunBody> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 32_768) throw new Error("Request too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as RunBody;
}

function configure(token: string): void {
  const path = join(home, "config.json");
  let config: RunnerConfig = {};
  if (existsSync(path)) {
    try { config = JSON.parse(readFileSync(path, "utf8")) as RunnerConfig; } catch { config = {}; }
  }
  config.agents = { ...config.agents, defaults: { ...config.agents?.defaults, model } };
  config.providers = {
    ...config.providers,
    nextclaw: {
      ...config.providers?.nextclaw,
      enabled: true,
      apiBase: "https://bibo-hosted.15353764479037.workers.dev/api/model/v1",
      apiKey: token,
      models: [model],
    },
  };
  writeFileSync(path, JSON.stringify(config));
  const identity = join(home, "workspace", "IDENTITY.md");
  if (!existsSync(identity) || readFileSync(identity, "utf8") === defaultIdentity) writeFileSync(identity, hostedIdentity);
}

async function runTar(args: string[], input: Readable | null, output: ServerResponse | null): Promise<void> {
  const child = spawn("tar", args, { stdio: ["pipe", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
  const inputDone = input ? pipeline(input, child.stdin) : Promise.resolve(child.stdin.end());
  const outputDone = output ? pipeline(child.stdout, output) : Promise.resolve(child.stdout.resume());
  const exit = new Promise<void>((resolve, reject) => child.on("close", (code) => code === 0 ? resolve() : reject(new Error(stderr || `tar exited ${code}`))));
  await Promise.all([inputDone, outputDone, exit]);
}

async function sendSnapshot(response: ServerResponse): Promise<void> {
  const temporary = await mkdtemp(join(tmpdir(), "bibo-snapshot-"));
  const archive = join(temporary, "home.tgz");
  const stagedHome = join(temporary, "home");
  const databases: { source: string; target: string }[] = [];
  try {
    await cp(home, stagedHome, {
      recursive: true,
      filter: (source, target) => {
        const name = basename(source);
        if (name === "config.json" || name === "logs" || name === "cache") return false;
        if (/\.(sqlite|db)(?:-(?:wal|shm|journal))?$/.test(name)) {
          if (/\.(sqlite|db)$/.test(name)) databases.push({ source, target });
          return false;
        }
        return true;
      },
    });
    for (const { source, target } of databases) {
      const database = new DatabaseSync(source, { readOnly: true, timeout: 2000 });
      try { await backup(database, target); }
      finally { database.close(); }
    }
    await runTar(["-czf", archive, "-C", stagedHome, "."], null, null);
    response.writeHead(200, { "content-type": "application/gzip", "cache-control": "no-store" });
    await pipeline(createReadStream(archive), response);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

async function sendRun(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await readJson(request);
  if (typeof body.message !== "string" || !body.message.trim() || body.message.length > 4000 || typeof body.token !== "string" || body.token.length > 4096) {
    return sendJson(response, 400, { error: "Invalid request" });
  }
  configure(body.token);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 85_000);
  const streaming = request.headers.accept?.includes("text/event-stream");
  const onClose = () => { if (!response.writableEnded) controller.abort(); };
  response.on("close", onClose);
  try {
    if (streaming) response.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" });
    const result = await runNextclawTask({
      input: body.message.trim(), sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined, signal: controller.signal,
      ...(streaming ? { onAssistantDelta: (delta: string) => {
        if (!response.destroyed && delta) response.write(`event: delta\ndata: ${JSON.stringify({ text: delta })}\n\n`);
      } } : {}),
    }, { homeDir: home });
    if (streaming) {
      response.end(`event: result\ndata: ${JSON.stringify({ text: result.text, sessionId: result.sessionId })}\n\n`);
      return;
    }
    return sendJson(response, 200, { text: result.text, sessionId: result.sessionId });
  } finally {
    clearTimeout(timeout);
    response.off("close", onClose);
  }
}

let busy = false;
const server = createServer(async (request, response) => {
  const route = new URL(request.url ?? "/", "http://localhost").pathname;
  if (route === "/health") return sendJson(response, 200, { ok: true });
  if (busy) return sendJson(response, 429, { error: "Bibo is busy" });
  busy = true;
  try {
    if (route === "/restore" && request.method === "POST") {
      await runTar(["-xz", "-C", home, "--no-same-owner", "--no-same-permissions"], request, null);
      return sendJson(response, 200, { ok: true });
    }
    if (route === "/snapshot" && request.method === "GET") return await sendSnapshot(response);
    if (route === "/run" && request.method === "POST") return await sendRun(request, response);
    return sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("bibo-runner-error", message);
    if (!response.headersSent) sendJson(response, message.includes("429") || message.includes("今日试用额度") ? 429 : 500, {
      error: message.includes("429") || message.includes("今日试用额度") ? "今日试用额度已用完，请明天再试。" : "Bibo could not complete this task. Please retry.",
      ...(route === "/snapshot" ? { diagnostic: message.slice(0, 300) } : {}),
    });
    else if (!response.destroyed && route === "/run") response.end(`event: error\ndata: ${JSON.stringify({ error: "Bibo 暂时无法完成这次任务，请稍后重试。" })}\n\n`);
    else response.destroy();
  } finally {
    busy = false;
  }
}).listen(Number(process.env.BIBO_PORT ?? 8080), "0.0.0.0");

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
