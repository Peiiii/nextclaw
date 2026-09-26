import type { Page } from "playwright";

const instant = "2026-09-25T09:00:00.000Z";

export async function mockApi(page: Page, longTitles = false, fileNavigation = false): Promise<void> {
  const sessions = [{ id: "session-a", title: "产品想法", createdAt: instant, updatedAt: instant, messageCount: 2 }];
  const messages = [{ role: "user", text: "今天先做什么？", at: instant }, { role: "assistant", text: "先整理一件最重要的事。", at: instant }];
  const projects = [{ id: "project-a", name: "Bibo", createdAt: instant, updatedAt: instant, version: 1 }];
  const tasks = [{ id: "task-a", projectId: "project-a", title: "梳理产品方案", description: "确认界面和数据主链路", status: "active", dueAt: null, subtasks: [{ id: "subtask-a", title: "核对方案", done: false }], source: { kind: "user" }, createdAt: instant, updatedAt: instant, version: 1 }];
  const events = [{ id: "event-a", title: "设计评审", description: "和团队对齐", startAt: new Date(Date.now() + 3_600_000).toISOString(), endAt: new Date(Date.now() + 7_200_000).toISOString(), source: { kind: "user" }, createdAt: instant, updatedAt: instant, version: 1 }];
  const inbox = [{ id: "inbox-a", kind: "decision", title: "确认方案方向", body: "Bibo 已整理好两个候选方案。请阅读后决定。", source: { kind: "task", id: "task-a" }, createdAt: instant, updatedAt: instant, readAt: null as string | null, resolvedAt: null as string | null, version: 1 }];
  const files = [{ id: "file-a", path: "想法.md", kind: "note", createdAt: instant, updatedAt: instant, version: 1 }];
  const contents: Record<string, string> = { "file-a": "# 一个想法\n\n让信息在需要时出现。" };
  if (fileNavigation) {
    const paths = ["A-empty", "B-folder", "B-folder/nested", "B-folder/nested/readme.md", "alph", "alpha", ...Array.from({ length: 10 }, (_, index) => `review-document-${index}.md`)];
    files.push(...paths.map((path, index) => ({ id: `navigation-${index}`, path, kind: index < 3 ? "folder" : "document", createdAt: instant, updatedAt: instant, version: 1 })));
  }
  if (longTitles) {
    const suffix = "会议纪要".repeat(6) + "UnbrokenTitle".repeat(6);
    for (const item of [...sessions, ...tasks, ...events, ...inbox]) item.title += suffix;
    projects[0]!.name += suffix;
    files[0]!.path = `想法${suffix}.md`;
    inbox[0]!.body += suffix;
  }
  const fileAction = (action: string, input: Record<string, unknown>): { result?: unknown; error?: string; status?: number } => {
    if (action === "file.list") {
      const matches = files.filter((file) => !input.kind || file.kind === input.kind).sort((a, b) => input.sort === "recent" ? b.updatedAt.localeCompare(a.updatedAt) || a.path.localeCompare(b.path) : a.path.localeCompare(b.path));
      const offset = Number(input.cursor ?? 0);
      const limit = Number(input.limit ?? 50);
      return { result: { items: matches.slice(offset, offset + limit), nextCursor: offset + limit < matches.length ? String(offset + limit) : null } };
    }
    if (action === "file.get") {
      const file = files.find((item) => item.id === input.id);
      return file ? { result: { ...file, content: contents[file.id] } } : { error: "File missing", status: 404 };
    }
    if (action === "file.create") {
      const file = { id: `file-${files.length}`, path: String(input.path), kind: String(input.kind), createdAt: instant, updatedAt: instant, version: 1 };
      files.push(file); contents[file.id] = String(input.content ?? "");
      return { result: { ...file, content: contents[file.id] } };
    }
    if (action === "file.delete") {
      const index = files.findIndex((file) => file.id === input.id);
      return { result: { deleted: files.splice(index, 1).map((file) => file.id) } };
    }
    if (action === "file.update" || action === "file.move") {
      const file = files.find((item) => item.id === input.id)!;
      if (file.version !== input.version) return { error: "版本冲突", status: 409 };
      if (action === "file.update") contents[file.id] = String(input.content);
      else file.path = String(input.path);
      file.version += 1;
      return { result: { ...file, content: contents[file.id] } };
    }
    return { error: `Unmocked action: ${action}`, status: 400 };
  };
  const spaceAction = (action: string, input: Record<string, unknown>): { result?: unknown; error?: string; status?: number } => {
    if (action.startsWith("file.")) return fileAction(action, input);
    if (action === "overview.get") return { result: { inbox: inbox.filter((item) => !item.resolvedAt), events, tasks: tasks.filter((item) => item.status !== "done"), notes: files.filter((item) => item.kind === "note"), projects: [{ id: "project-a", name: "Bibo", total: tasks.length, done: tasks.filter((item) => item.status === "done").length }], counts: { unread: inbox.filter((item) => !item.readAt && !item.resolvedAt).length, activeTasks: tasks.filter((item) => item.status !== "done").length } } };
    if (action === "project.list") return { result: { items: projects, nextCursor: null } };
    if (action === "task.list") return { result: { items: tasks, nextCursor: null } };
    if (action === "event.list") return { result: { items: events.filter((event) => (!input.from || event.endAt >= String(input.from)) && (!input.to || event.startAt <= String(input.to))), nextCursor: null } };
    if (action === "inbox.list") return { result: { items: inbox, nextCursor: null } };
    if (action === "task.create") {
      const task = { ...tasks[0]!, ...input, id: `task-${tasks.length}`, version: 1, status: "planned" };
      tasks.push(task); return { result: task };
    }
    if (action === "event.create") {
      const event = { ...events[0]!, ...input, id: `event-${events.length}`, version: 1 };
      events.push(event); return { result: event };
    }
    if (action === "inbox.read" || action === "inbox.resolve") {
      const item = inbox.find((entry) => entry.id === input.id)!;
      item.readAt = new Date().toISOString(); if (action === "inbox.resolve") item.resolvedAt = item.readAt;
      item.version += 1; return { result: item };
    }
    return { error: `Unmocked action: ${action}`, status: 400 };
  };
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const body = request.method() === "POST" ? request.postDataJSON() as Record<string, unknown> : {};
    const reply = (value: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) });
    if (path === "/api/auth/me") return reply({ user: { id: "smoke", email: longTitles ? `${"long-account".repeat(5)}@example.com` : "smoke@example.com" } });
    if (path === "/api/sessions" && request.method() === "GET") return reply({ sessions });
    if (path === "/api/sessions" && request.method() === "POST") {
      const session = { id: `session-${sessions.length}`, title: "新对话", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messageCount: 0 };
      sessions.unshift(session); return reply({ session });
    }
    if (path === "/api/sessions/rename") { const session = sessions.find((item) => item.id === body.id)!; session.title = String(body.title); return reply({ session }); }
    if (path === "/api/sessions/delete") { const index = sessions.findIndex((item) => item.id === body.id); sessions.splice(index, 1); return reply({ ok: true }); }
    if (path === "/api/history") return reply({ messages });
    if (path === "/api/space") {
      const response = spaceAction(String(body.action), (body.input ?? {}) as Record<string, unknown>);
      return reply(response.error ? { error: response.error } : { result: response.result }, response.status ?? 200);
    }
    if (path === "/api/chat") {
      const input = String(body.message);
      messages.push({ role: "user", text: input, at: instant }, { role: "assistant", text: "我们已经把它记下来了。", at: instant });
      const session = sessions[0]!; session.messageCount = messages.length;
      const frames = [
        ["accepted", { runId: "run-a" }], ["delta", { text: "我们已经把它记下来了。" }],
        ["saving", {}], ["committed", { text: "我们已经把它记下来了。", messages, session }],
      ].map(([name, value]) => `event: ${name}\ndata: ${JSON.stringify(value)}\n\n`).join("");
      return route.fulfill({ status: 200, contentType: "text/event-stream", body: frames });
    }
    return path === "/api/chat/availability" ? reply({ ok: true }) : reply({ error: `Unmocked path: ${path}` }, 404);
  });
}
