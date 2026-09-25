import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { Plugin } from "vite";

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
    if (raw.length > 8_192) throw new Error("本地测试输入过长。");
  }
  return JSON.parse(raw || "{}") as Record<string, unknown>;
}

function event(response: ServerResponse, name: string, value: unknown): void {
  response.write(`event: ${name}\ndata: ${JSON.stringify(value)}\n\n`);
}

export function biboUiDevController(): Plugin {
  let messages = initialMessages();
  const runs = new Map<string, () => void>();
  const user = { id: "local-ui-preview", email: "preview@bibo.local" };

  return {
    name: "bibo-local-ui-preview",
    apply: "serve",
    configureServer: (server) => {
      server.middlewares.use(async (request, response, next) => {
        const pathname = request.url?.split("?", 1)[0];
        if (!pathname?.startsWith("/api/")) return next();

        try {
          if (pathname === "/api/auth/me") return json(response, { user });
          if (pathname === "/api/history") return json(response, { messages });
          if (pathname === "/api/reset") {
            messages = [];
            return json(response, { ok: true });
          }
          if (pathname === "/api/auth/logout") return json(response, { ok: true });
          if (pathname === "/api/cancel") {
            const runId = (await body(request)).runId;
            if (typeof runId === "string") runs.get(runId)?.();
            return json(response, { ok: true });
          }
          if (pathname !== "/api/chat" || request.method !== "POST") return json(response, { error: "本地预览没有这个接口。" }, 404);

          const input = (await body(request)).message;
          if (typeof input !== "string" || !input.trim()) return json(response, { error: "请输入消息。" }, 400);

          const runId = randomUUID();
          let stopped = false;
          let timer: ReturnType<typeof setTimeout> | undefined;
          const stop = () => {
            stopped = true;
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
          response.on("close", () => { stopped = true; clearTimeout(timer); runs.delete(runId); });

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
              messages = [...messages,
                { role: "user", text: input.trim(), at },
                { role: "assistant", text: showcase, at: new Date(Date.now() + 1).toISOString() }];
              event(response, "committed", { messages, text: showcase });
              runs.delete(runId);
              response.end();
            }, 250);
          };
          timer = setTimeout(sendNext, 250);
        } catch (error) {
          if (!response.headersSent) json(response, { error: error instanceof Error ? error.message : "本地预览失败。" }, 400);
          else response.end();
        }
      });
    },
  };
}
