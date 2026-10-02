import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Plugin } from "vite";
import { BiboSpaceService, BiboSpaceError } from "../src/features/bibo-domain/services/bibo-space.service";
import { serveBiboPreviewAsset } from "./markdown-editor/bibo-assets-preview.service";

type Message = { role: "user" | "assistant"; text: string; at: string };

const showcase = `# 一份适合阅读的回答

Markdown 应该帮助你**快速找到重点**，而不是让标题、列表和正文挤成一团。这里也有 \`行内代码\`、[安全外链](https://example.com) 和一段较长的解释，用来检查真实聊天宽度下的换行与留白。

## 从这里开始

1. 先确认目标，再拆成能执行的小步骤。
2. 保留必要的上下文：
   - 当前状态
   - 下一步动作
   - 完成的判断标准

> 这是一段引用。它需要和正文有明确的层次，也要能在手机上自然换行。

### 代码示例

\`\`\`ts
type Step = { title: string; done: boolean };

const next = (steps: Step[]) =>
  steps.find((step) => !step.done);
\`\`\`

| 内容 | 状态 |
| :--- | ---: |
| 标题与列表 | 已展示 |
| 表格与代码 | 已展示 |

- [x] 已完成的事项
- [ ] 仍需处理的事项

---

如果你继续追问，这里会按**真实事件节奏**逐段显示，而不是等文本完成后播放。`;

const initialMessages = (): Message[] => [
  { role: "user", text: "展示一下 Bibo 的 Markdown 阅读体验", at: "2026-09-25T09:00:00.000Z" },
  { role: "assistant", text: showcase, at: "2026-09-25T09:00:01.000Z" },
];

function json(response: ServerResponse, body: unknown, status = 200): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of request) {
    raw += String(chunk);
    if (raw.length > 1_048_576) throw new Error("本地测试输入过长。");
  }
  return JSON.parse(raw || "{}") as Record<string, unknown>;
}

function event(response: ServerResponse, name: string, value: unknown): void {
  response.write(`event: ${name}\ndata: ${JSON.stringify(value)}\n\n`);
}

async function downloadFile(request: IncomingMessage, response: ServerResponse, space: BiboSpaceService): Promise<void> {
  const path = new URL(request.url!, "http://localhost").searchParams.get("path");
  const detail = await space.execute("file.get", { path }) as { path: string; content: string | null };
  if (detail.content === null) return json(response, { error: "请选择文件。" }, 400);
  response.writeHead(200, { "content-type": "application/octet-stream", "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(detail.path.split("/").at(-1)!)}`, "cache-control": "no-store" });
  response.end(detail.content);
}

async function createPreviewSpace() {
    const home = process.env.BIBO_UI_HOME || await mkdtemp(join(tmpdir(), "personal-agent-preview-"));
    await mkdir(join(home, "workspace"), { recursive: true });
    const space = new BiboSpaceService(home);
    if (process.env.BIBO_UI_HOME) return { home, space };
    const project = await space.execute("project.create", { name: "个人空间" }) as { id: string };
    await space.execute("task.create", { title: "完成这一轮体验评审", description: "核对原型、日程和文件工作区。", projectId: project.id, priority: "high", status: "active" });
    await space.execute("file.create", { path: "笔记", kind: "folder" });
    await space.execute("file.create", { path: "笔记/留一点时间给自己.md", kind: "note", content: "# 留一点时间给自己\n\n下午去河边走走，把新想法记下来。" });
    await space.execute("file.create", { path: "工作", kind: "folder" });
    await space.execute("file.create", { path: "工作/体验评审.md", kind: "document", content: "# 体验评审\n\n- 月历每天直接展示安排\n- 文件与笔记共用同一份内容\n- 移动端一次聚焦一件事" });
    const today = new Date(); today.setHours(14, 0, 0, 0);
    for (const [offset, title] of [[0, "产品体验评审"], [2, "留给阅读的时间"], [5, "整理这一周的想法"]] as const) {
      const start = new Date(today); start.setDate(start.getDate() + offset);
      await space.execute("event.create", { title, startAt: start.toISOString(), endAt: new Date(start.getTime() + 3_600_000).toISOString() });
    }
    await space.execute("inbox.create", { title: "这一轮方案，等你看一眼", body: "这是本地预览的示例内容。任务、日程和文件操作使用真实的文件领域服务。", kind: "decision", source: { kind: "bibo" } });
    return { home, space };
}

async function resetPreviewHome(home: string): Promise<void> {
  await rm(join(home, "bibo"), { recursive: true, force: true });
  await rm(join(home, "workspace"), { recursive: true, force: true });
  await mkdir(join(home, "workspace"));
}

export function biboUiDevController(): Plugin {
  const live = process.env.BIBO_UI_LIVE === "1";
  let messages = live ? [] : initialMessages();
  const sessions = (live ? [] : [{ id: "preview-session", title: "一起打磨个人空间", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messageCount: messages.length }]);
  const histories = new Map<string, Message[]>([["preview-session", messages]]);
  const spaceReady = createPreviewSpace();
  const localAgent = live ? spaceReady.then(async ({ home, space }) => {
    const { BiboLocalAgentController } = await import("./local-preview/bibo-local-agent.controller");
    return new BiboLocalAgentController(home, space);
  }) : null;
  const runs = new Map<string, () => void>();
  const user = { id: "local-ui-preview", email: "preview@bibo.local" };

  const streamChat = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
  const chatInput = await body(request);
  const input = chatInput.message;
  const session = sessions.find((item) => item.id === chatInput.sessionId) ?? sessions[0];
  if (!session) return json(response, { error: "请先新建会话" }, 400);
  if (typeof input !== "string" || !input.trim()) return json(response, { error: "请输入消息。" }, 400);

  const runId = randomUUID();
  let stopped = false;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    stopped = true;
    controller.abort();
    clearTimeout(timer);
    runs.delete(runId);
    if (!response.writableEnded) {
      event(response, "error", { error: "本地预览已停止生成。" });
      response.end();
    }
  };
  runs.set(runId, stop);
  response.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });
  event(response, "accepted", { runId });
  response.on("close", () => { stopped = true; controller.abort(); clearTimeout(timer); runs.delete(runId); });

  if (localAgent) {
    await (await localAgent).stream({ sessionId: session.id, message: input.trim(), signal: controller.signal,
      question: chatInput.question as { id: string; action: "answer" | "dismiss" } | undefined }, response, result => {
      messages = result.messages;
      histories.set(session.id, messages); session.messageCount = messages.length; session.updatedAt = new Date().toISOString();
      return session;
    });
    runs.delete(runId);
    return;
  }

  const chunks = showcase.match(/[\s\S]{1,42}/g) ?? [];
  let index = 0;
  const sendNext = () => {
    if (stopped) return;
    if (index < chunks.length) {
      event(response, "delta", { text: chunks[index++] });
      timer = setTimeout(sendNext, 90);
      return;
    }
    event(response, "saving", {});
    timer = setTimeout(() => {
      if (stopped) return;
      const at = new Date().toISOString();
      messages = [...(histories.get(session.id) ?? []),
        { role: "user", text: input.trim(), at },
        { role: "assistant", text: showcase, at: new Date(Date.now() + 1).toISOString() }];
      histories.set(session.id, messages); session.messageCount = messages.length;
      event(response, "committed", { messages, text: showcase, session });
      runs.delete(runId);
      response.end();
    }, 250);
  };
  timer = setTimeout(sendNext, 250);
  };

  const manageSessions = async (pathname: string, request: IncomingMessage, response: ServerResponse): Promise<void> => {
  if (pathname === "/api/sessions") {
    if (request.method === "GET") return json(response, { sessions });
    const session = { id: randomUUID(), title: "新对话", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messageCount: 0 };
    sessions.unshift(session); histories.set(session.id, []);
    return json(response, { session });
  }
  if (pathname === "/api/sessions/rename" || pathname === "/api/sessions/delete") {
    const input = await body(request);
    const index = sessions.findIndex((session) => session.id === input.id);
    if (index < 0) return json(response, { error: "会话不存在" }, 404);
    if (pathname.endsWith("rename")) { sessions[index]!.title = String(input.title); return json(response, { session: sessions[index] }); }
    if (localAgent) await (await localAgent).remove(sessions[index]!.id);
    histories.delete(sessions[index]!.id); sessions.splice(index, 1);
    return json(response, { ok: true });
  }
    json(response, { error: "会话接口不存在" }, 404);
  };

  return {
    name: "bibo-local-ui-preview",
    apply: "serve",
    configureServer: (server) => {
      const assets = async (request: IncomingMessage, response: ServerResponse) => {
        const { biboAssetsRoute } = await server.ssrLoadModule("/src/features/assets/index.ts");
        return serveBiboPreviewAsset(request, response, (await spaceReady).home, biboAssetsRoute);
      };
      server.httpServer?.once("close", () => { void localAgent?.then(agent => agent.dispose()); if (!process.env.BIBO_UI_HOME) void spaceReady.then(({ home }) => rm(home, { recursive: true, force: true })); });
      server.middlewares.use(async (request, response, next) => {
        const pathname = request.url?.split("?", 1)[0];
        if (!pathname?.startsWith("/api/")) return next();

        try {
          if (live && (request.headers.origin && request.headers.origin !== `http://${request.headers.host}` || request.headers["sec-fetch-site"] === "cross-site")) return json(response, { error: "请从本地预览页面操作。" }, 403);
          if (pathname === "/api/auth/me") return json(response, { user });
          if (pathname === "/api/assets" || pathname.startsWith("/api/assets/")) return assets(request, response);
          if (pathname === "/api/chat/availability" || pathname === "/api/runs")
            return json(response, pathname === "/api/runs" ? { run: null, activeRuns: [] } : { ok: true });
          if (pathname === "/api/workspace/file" && request.method === "GET") return downloadFile(request, response, (await spaceReady).space);
          if (pathname === "/api/history") {
            const selectedId = new URL(request.url!, "http://localhost").searchParams.get("id");
            return json(response, { messages: histories.get(selectedId ?? sessions[0]?.id ?? "") ?? [] });
          }
          if (pathname === "/api/space") {
            const input = await body(request);
            return json(response, { result: await (await spaceReady).space.execute(String(input.action), (input.input ?? {}) as Record<string, unknown>) });
          }
          if (pathname.startsWith("/api/sessions")) return manageSessions(pathname, request, response);
          if (pathname === "/api/reset") {
            messages = []; sessions.length = 0; histories.clear();
            const { home } = await spaceReady;
            await resetPreviewHome(home);
            return json(response, { ok: true });
          }
          if (pathname === "/api/auth/logout") return json(response, { ok: true });
          if (pathname === "/api/cancel") {
            const runId = (await body(request)).runId;
            if (typeof runId === "string") runs.get(runId)?.();
            return json(response, { ok: true });
          }
          if (pathname !== "/api/chat" || request.method !== "POST") return json(response, { error: "本地预览没有这个接口。" }, 404);

          return streamChat(request, response);
        } catch (error) {
          if (!response.headersSent) json(response, { error: error instanceof Error ? error.message : "本地预览失败。" }, error instanceof BiboSpaceError ? error.status : 400);
          else response.end();
        }
      });
    },
  };
}
