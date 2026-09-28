import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";
import { backup, DatabaseSync } from "node:sqlite";
import { NextclawHarness, type NcpEndpointEvent, type NextclawTaskInput, type NextclawUserQuestion } from "@nextclaw/harness";
import { BiboSpaceError, BiboSpaceService } from "@/features/bibo-domain";
import { BiboSpaceContribution } from "./bibo-space.contribution";
import { exportBiboEdgeState, importBiboEdgeState } from "./migration/bibo-edge-export.service";
import { defaultIdentity, preSearchIdentity, legacyHostedIdentity, hostedIdentity } from "./utils/bibo-identity.utils";
import { BiboRunError, errorDetails, logDiagnostic, readTrace, runFailure, traceHeaders, type RunTrace } from "./diagnostics/bibo-diagnostics.utils";

const home = process.env.NEXTCLAW_HOME ?? "/data";
const runtimeId = randomUUID();
const model = "nextclaw/deepseek-flash";
mkdirSync(join(home, "workspace"), { recursive: true });
const space = new BiboSpaceService(home);

type RunnerConfig = {
  agents?: { defaults?: Record<string, unknown> };
  providers?: Record<string, Record<string, unknown>>;
  search?: Record<string, unknown>;
};
type RunBody = { message?: unknown; token?: unknown; sessionId?: unknown; searchEnabled?: unknown; questionId?: unknown; questionAction?: unknown };

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-runtime-id": runtimeId });
  response.end(JSON.stringify(value));
}

async function readJson<T>(request: IncomingMessage, maxBytes = 32_768): Promise<T> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new BiboSpaceError("请求内容过大。", 413);
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}

function configure(token: string, searchEnabled: boolean, trace: RunTrace): void {
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
      apiBase: "https://app.bibo.bot/api/model/v1",
      apiKey: token,
      extraHeaders: traceHeaders(trace),
      models: [model],
    },
  };
  config.search = {
    provider: "exa", enabledProviders: searchEnabled ? ["exa"] : [], defaults: { maxResults: 10 },
    providers: { exa: { apiKey: searchEnabled ? token : "", baseUrl: "https://app.bibo.bot/api/search/exa" } },
  };
  writeFileSync(path, JSON.stringify(config));
  const identity = join(home, "workspace", "IDENTITY.md");
  const savedIdentity = existsSync(identity) ? readFileSync(identity, "utf8") : null;
  if (savedIdentity === null || [defaultIdentity, legacyHostedIdentity, preSearchIdentity, hostedIdentity].includes(savedIdentity)) {
    writeFileSync(identity, searchEnabled ? hostedIdentity : preSearchIdentity);
  }
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
        // Derived from the journal on load; its live rebuilds/atomic renames
        // cannot be copied consistently alongside canonical session data.
        if (relative(home, source) === join("sessions", ".ncp-agent-journal", ".message-projections")) return false;
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

async function executeHarnessRun(input: { message: string; sessionId: string; questionId?: string; questionAction?: "answer" | "dismiss" },
  signal: AbortSignal, callbacks: Pick<NextclawTaskInput, "onEvent" | "onAssistantDelta">): Promise<{ text: string; questions: NextclawUserQuestion[]; displayEvents: BiboSpaceContribution["displayEvents"] }> {
  const harness = new NextclawHarness({
      homeDir: home,
      allowedToolNames: ["bibo", "show_file", "web_search", "web_fetch", "tool_schema", "request_user_input_async"],
      contextProfile: "embedded",
      sessionSearchEnabled: false,
      sessionTitleEnabled: false,
  });
  const contribution = new BiboSpaceContribution(space, input.sessionId);
  harness.contributions.register(contribution);
  try {
    await harness.start();
    const result = input.questionId
      ? await harness.answerUserQuestion({ sessionId: input.sessionId, questionId: input.questionId,
          action: input.questionAction!, ...(input.questionAction === "answer" ? { answer: input.message.trim() } : {}), signal, ...callbacks })
      : await harness.runTask({ input: input.message.trim(), sessionId: input.sessionId, signal, ...callbacks });
    if (!result.text) throw new BiboRunError("QUESTION_ALREADY_RESOLVED", 409, "这个问题已经处理，请刷新会话。");
    return { text: result.text, questions: await harness.listUserQuestions(input.sessionId), displayEvents: contribution.displayEvents };
  } finally { await harness.dispose(); }
}

async function sendRun(request: IncomingMessage, response: ServerResponse, requestTrace: RunTrace): Promise<void> {
  const body = await readJson<RunBody>(request);
  const questionReply = body.questionId !== undefined;
  if (typeof body.message !== "string" || !body.message.trim() || body.message.length > 4000 || typeof body.token !== "string" || body.token.length > 4096 ||
    (questionReply && (typeof body.questionId !== "string" || !body.questionId || !["answer", "dismiss"].includes(String(body.questionAction))))) {
    return sendJson(response, 400, { error: "Invalid request" });
  }
  const sessionId = typeof body.sessionId === "string" && body.sessionId ? body.sessionId : crypto.randomUUID();
  const trace = { ...requestTrace, sessionId };
  configure(body.token, body.searchEnabled === true, trace);
  logDiagnostic("container", "run.started", { ...trace, runtimeId });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new BiboRunError("RUN_TIMEOUT", 504, "本次生成超时，本轮未保存，请稍后重试。")), 85_000);
  const streaming = request.headers.accept?.includes("text/event-stream");
  const onClose = () => { if (!response.writableEnded) controller.abort(); };
  response.on("close", onClose);
  try {
    if (streaming) response.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" });
    const callbacks = {
        onEvent: (event: NcpEndpointEvent) => {
          if (event.type !== "message.sent") return;
          const message = (event.payload as { message?: { metadata?: Record<string, unknown> } }).message;
          if (message?.metadata?.nextclaw_timeline_kind !== "context_compaction") return;
          const checkpoint = message.metadata.checkpoint as { status?: string; phase?: string } | undefined;
          logDiagnostic("container", "context.compaction", { ...trace, compactionStatus: checkpoint?.status, phase: checkpoint?.phase });
        },
        ...(streaming ? { onAssistantDelta: (delta: string) => {
          if (!response.destroyed && delta) response.write(`event: delta\ndata: ${JSON.stringify({ text: delta })}\n\n`);
        } } : {}),
    };
    const { text, questions, displayEvents } = await executeHarnessRun({ message: body.message, sessionId,
      ...(questionReply ? { questionId: body.questionId as string, questionAction: body.questionAction as "answer" | "dismiss" } : {}) }, controller.signal, callbacks);
    logDiagnostic("container", "run.generated", { ...trace, runtimeId });
    sendRunResult(response, { text, sessionId }, questions, displayEvents, Boolean(streaming));
  } catch (error) {
    const failure = runFailure(controller.signal.aborted ? controller.signal.reason : error, controller.signal.aborted);
    logDiagnostic("container", "run.failed", { ...trace, ...errorDetails(error), errorCode: failure.code }, "error");
    throw failure;
  } finally {
    clearTimeout(timeout);
    response.off("close", onClose);
  }
}

function sendRunResult(response: ServerResponse, result: { text: string; sessionId: string }, questions: NextclawUserQuestion[], displayEvents: BiboSpaceContribution["displayEvents"], streaming: boolean): void {
  if (streaming) {
    for (const event of displayEvents) response.write(`event: show-content\ndata: ${JSON.stringify(event)}\n\n`);
    response.end(`event: result\ndata: ${JSON.stringify({ text: result.text, sessionId: result.sessionId, questions })}\n\n`);
    return;
  }
  return sendJson(response, 200, { text: result.text, sessionId: result.sessionId, questions, displayEvents });
}

async function importSpaceState(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await readJson<{ state?: unknown }>(request, 32 * 1024 * 1024);
  await space.importState(body.state);
  sendJson(response, 200, { ok: true });
}

async function deleteSession(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await readJson<{ id?: unknown }>(request);
  if (typeof body.id !== "string" || !body.id) return sendJson(response, 400, { error: "会话编号不正确。" });
  const harness = new NextclawHarness({ homeDir: home });
  try { await harness.start(); await harness.sessions.delete(body.id); }
  finally { await harness.dispose(); }
  sendJson(response, 200, { ok: true });
}

let busy = false;
const server = createServer(async (request, response) => {
  const route = new URL(request.url ?? "/", "http://localhost").pathname;
  const trace = readTrace(new Headers({
    "x-bibo-run-id": String(request.headers["x-bibo-run-id"] ?? ""),
    "x-bibo-session-id": String(request.headers["x-bibo-session-id"] ?? ""),
  }));
  const started = Date.now();
  if (route === "/health") return sendJson(response, 200, { ok: true });
  if (busy) return sendJson(response, 429, { error: "Bibo is busy" });
  busy = true;
  try {
    if (route === "/restore" && request.method === "POST") {
      await runTar(["-xz", "-C", home, "--no-same-owner", "--no-same-permissions"], request, null);
      return sendJson(response, 200, { ok: true });
    }
    if (route === "/snapshot" && request.method === "GET") return await sendSnapshot(response);
    if (route === "/edge/export" && request.method === "POST") {
      const body = await readJson<{ sessionIds?: unknown }>(request);
      if (!Array.isArray(body.sessionIds) || body.sessionIds.length > 1000 ||
        !body.sessionIds.every((id) => typeof id === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(id))) {
        return sendJson(response, 400, { error: "Invalid session IDs" });
      }
      return sendJson(response, 200, await exportBiboEdgeState(home, space, body.sessionIds));
    }
    if (route === "/edge/import" && request.method === "POST") {
      const source = await readJson<Parameters<typeof importBiboEdgeState>[2]>(request, 64 * 1024 * 1024);
      await importBiboEdgeState(home, space, source);
      return sendJson(response, 200, { ok: true });
    }
    if (route === "/space/state" && request.method === "GET") return sendJson(response, 200, { state: await space.exportState() });
    if (route === "/space/state" && request.method === "POST") return await importSpaceState(request, response);
    if (route === "/run" && request.method === "POST") return await sendRun(request, response, trace);
    if (route === "/sessions/delete" && request.method === "POST") return await deleteSession(request, response);
    if (route === "/space" && request.method === "POST") {
      const body = await readJson<{ action?: unknown; input?: unknown }>(request, 1_100_000);
      if (typeof body.action !== "string") return sendJson(response, 400, { error: "缺少操作名称。" });
      const result = await space.execute(body.action, body.input ?? {});
      return sendJson(response, 200, { result });
    }
    return sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failure = runFailure(error);
    logDiagnostic("container", "request.failed", { ...trace, ...errorDetails(error), stage: route, errorCode: failure.code, status: failure.status, runtimeId, durationMs: Date.now() - started }, "error");
    if (route === "/run") {
      const value = { error: failure.message, code: failure.code, status: failure.status, ...trace };
      if (!response.headersSent) sendJson(response, failure.status, value);
      else if (!response.destroyed) response.end(`event: error\ndata: ${JSON.stringify(value)}\n\n`);
      return;
    }
    if (!response.headersSent) sendJson(response, error instanceof BiboSpaceError ? error.status : message.includes("429") || message.includes("今日试用额度") ? 429 : 500, {
      error: error instanceof BiboSpaceError ? error.message : message.includes("429") || message.includes("今日试用额度") ? "今日试用额度已用完，请明天再试。" : "Bibo could not complete this task. Please retry.",
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
