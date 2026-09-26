import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { BiboSpaceError, BiboSpaceService } from "./bibo-space.service";
import type { BiboTask, BiboOverview } from "@nextclaw/bibo-client";

const instant = "2026-09-25T09:00:00.000Z";

test("attention filters apply before pagination and completion undo respects newer versions", async (t) => {
  const home = await mkdtemp(join(tmpdir(), "task-attention-"));
  t.after(() => rm(home, { recursive: true, force: true }));
  const space = new BiboSpaceService(home);
  const boundary = "2026-09-26T16:00:00.000Z"; // Next local midnight in UTC+8.
  const overdue = await space.execute("task.create", { title: "逾期", status: "active", dueAt: instant }) as BiboTask;
  await space.execute("task.create", { title: "明天", dueAt: boundary });
  await space.execute("task.create", { title: "今天", dueAt: "2026-09-26T23:59:59+08:00" });
  await space.execute("task.create", { title: "已完成", status: "done", dueAt: instant });
  await space.execute("task.create", { title: "无日期" });
  const first = await space.execute("task.list", { open: true, dueBefore: boundary, limit: 1 }) as { items: BiboTask[]; nextCursor: string };
  assert.equal(first.items[0]?.title, "逾期");
  const second = await space.execute("task.list", { open: true, dueBefore: boundary, limit: 1, cursor: first.nextCursor }) as { items: BiboTask[]; nextCursor: string | null };
  assert.equal(second.items[0]?.title, "今天"); assert.equal(second.nextCursor, null);
  const upcoming = await space.execute("task.list", { open: true, dueFrom: boundary }) as { items: BiboTask[] };
  assert.deepEqual(upcoming.items.map((task) => task.title), ["明天"]);
  const done = await space.execute("task.update", { id: overdue.id, version: overdue.version, status: "done" }) as BiboTask;
  const restored = await space.execute("task.update", { id: done.id, version: done.version, status: overdue.status }) as BiboTask;
  assert.equal(restored.status, "active"); assert.equal(restored.completedAt, null);
  await assert.rejects(space.execute("task.update", { id: done.id, version: done.version, status: "planned" }), (error: unknown) => error instanceof BiboSpaceError && error.status === 409);
  const reminder = await space.execute("inbox.create", { title: "待读", body: "内容" }) as { id: string; version: number };
  const unread = await space.execute("inbox.list", { unread: true }) as { items: Array<{ id: string }> };
  assert.ok(unread.items.some((item) => item.id === reminder.id));
  await space.execute("inbox.read", reminder);
  assert.equal((await space.execute("inbox.list", { unread: true }) as { items: unknown[] }).items.length, 0);
});

test("task priority, dates, completion and cancellation survive reload and update overview", async (t) => {
  const home = await mkdtemp(join(tmpdir(), "task-lifecycle-"));
  t.after(() => rm(home, { recursive: true, force: true }));
  const space = new BiboSpaceService(home);
  let task = await space.execute("task.create", { title: "评审", description: "整理截图", priority: "high", startAt: instant, dueAt: "2026-09-26T09:00:00Z" }) as BiboTask;
  assert.equal(task.priority, "high");
  await assert.rejects(space.execute("task.update", { id: task.id, version: task.version, dueAt: "2026-09-24T09:00:00Z" }), /截止时间不能早于/);
  task = await space.execute("task.update", { id: task.id, version: task.version, status: "done" }) as BiboTask;
  assert.ok(task.completedAt);
  task = await space.execute("task.update", { id: task.id, version: task.version, status: "active" }) as BiboTask;
  assert.equal(task.completedAt, null);
  task = await space.execute("task.update", { id: task.id, version: task.version, status: "cancelled" }) as BiboTask;
  const reopened = new BiboSpaceService(home);
  assert.deepEqual(await reopened.execute("task.get", { id: task.id }), task);
  assert.equal((await reopened.execute("overview.get") as BiboOverview).counts.activeTasks, 0);
  assert.equal((await reopened.execute("task.list", { query: "截图" }) as { items: BiboTask[] }).items[0]?.id, task.id);
  assert.equal((await reopened.execute("task.list", { query: "不匹配" }) as { items: BiboTask[] }).items.length, 0);
});

test("notes and file tree share one stable object through edit and move", async (t) => {
  const home = await mkdtemp(join(tmpdir(), "bibo-space-test-"));
  t.after(() => rm(home, { recursive: true, force: true }));
  await mkdir(join(home, "workspace"));
  const space = new BiboSpaceService(home);
  const folder = await space.execute("file.create", { path: "Projects", kind: "folder" }) as { id: string };
  const note = await space.execute("file.create", { path: "Projects/Idea.md", kind: "note", content: "first" }) as { id: string; version: number };
  const changed = await space.execute("file.update", { id: note.id, version: note.version, content: "second" }) as { version: number };
  await assert.rejects(space.execute("file.update", { id: note.id, version: note.version, content: "stale" }), (error: unknown) => error instanceof BiboSpaceError && error.status === 409);
  const moved = await space.execute("file.move", { id: folder.id, version: 1, path: "Archive" }) as { id: string };
  assert.equal(moved.id, folder.id);
  const current = await space.execute("file.get", { id: note.id }) as { path: string; content: string; version: number };
  assert.equal(current.path, "Archive/Idea.md");
  assert.equal(current.content, "second");
  assert.equal(current.version, changed.version + 1);
  assert.equal(await readFile(join(home, "workspace", "Archive", "Idea.md"), "utf8"), "second");
  const reopened = new BiboSpaceService(home);
  assert.deepEqual(await reopened.execute("file.get", { id: note.id }), current);
  const overview = await reopened.execute("overview.get") as { notes: Array<{ id: string }> };
  assert.equal(overview.notes[0]?.id, note.id);
  const matches = await reopened.execute("file.list", { query: "archive/idea" }) as { items: Array<{ id: string }> };
  assert.deepEqual(matches.items.map((item) => item.id), [note.id]);
  const ancestors = await reopened.execute("file.list", { ancestorOf: "Archive/Idea.md" }) as { items: Array<{ id: string }> };
  assert.deepEqual(ancestors.items.map((item) => item.id), [folder.id]);
});

test("note pages filter before pagination and sort by recent edits", async (t) => {
  const home = await mkdtemp(join(tmpdir(), "bibo-note-pages-"));
  t.after(() => rm(home, { recursive: true, force: true }));
  await mkdir(join(home, "workspace"));
  const space = new BiboSpaceService(home);
  for (let index = 0; index < 101; index += 1) {
    await space.execute("file.create", { path: `A-${String(index).padStart(3, "0")}.md`, kind: "document" });
  }
  const older = await space.execute("file.create", { path: "Z-older.md", kind: "note" }) as { id: string; version: number };
  const newer = await space.execute("file.create", { path: "Z-newer.md", kind: "note" }) as { id: string };
  const firstFiles = await space.execute("file.list", { limit: 100 }) as { items: Array<{ id: string }>; nextCursor: string | null };
  assert.equal(firstFiles.items.some((file) => file.id === older.id), false);
  assert.equal(firstFiles.nextCursor, "100");
  const firstNotes = await space.execute("file.list", { kind: "note", sort: "recent", limit: 1 }) as { items: Array<{ id: string }>; nextCursor: string | null };
  assert.equal(firstNotes.items[0]?.id, newer.id);
  assert.equal(firstNotes.nextCursor, "1");
  const secondNotes = await space.execute("file.list", { kind: "note", sort: "recent", limit: 1, cursor: firstNotes.nextCursor }) as { items: Array<{ id: string }>; nextCursor: string | null };
  assert.equal(secondNotes.items[0]?.id, older.id);
  assert.equal(secondNotes.nextCursor, null);
  await new Promise((resolve) => setTimeout(resolve, 3));
  await space.execute("file.update", { id: older.id, version: older.version, content: "changed" });
  const reordered = await space.execute("file.list", { kind: "note", sort: "recent", limit: 1 }) as { items: Array<{ id: string }> };
  assert.equal(reordered.items[0]?.id, older.id);
});

test("structured actions validate references, versions, and idempotent create", async (t) => {
  const home = await mkdtemp(join(tmpdir(), "bibo-space-test-"));
  t.after(() => rm(home, { recursive: true, force: true }));
  await mkdir(join(home, "workspace"));
  const space = new BiboSpaceService(home);
  const project = await space.execute("project.create", { name: "Bibo" }) as { id: string; version: number };
  const input = { title: "Finish design", projectId: project.id, status: "active", subtasks: [{ title: "Draft", done: false }], requestId: "create-task-once" };
  const task = await space.execute("task.create", input, { kind: "agent", sessionId: "session-1" }) as { id: string; version: number; status: string; subtasks: unknown[]; source: { sessionId: string } };
  assert.equal(task.source.sessionId, "session-1");
  assert.equal(task.status, "active");
  assert.equal(task.subtasks.length, 1);
  assert.deepEqual(await space.execute("task.create", input), task);
  const updated = await space.execute("task.update", { id: task.id, version: task.version, status: "active", subtasks: [{ title: "Review", done: false }] }) as { version: number; subtasks: unknown[] };
  assert.equal(updated.subtasks.length, 1);
  await assert.rejects(space.execute("task.update", { id: task.id, version: task.version, status: "done" }), (error: unknown) => error instanceof BiboSpaceError && error.status === 409);
  await assert.rejects(space.execute("event.create", { title: "Bad", startAt: "2026-09-25T12:00:00Z", endAt: "2026-09-25T11:00:00Z" }), (error: unknown) => error instanceof BiboSpaceError && error.status === 400);
  const event = await space.execute("event.create", { title: "Review", startAt: "2026-09-25T10:00:00Z", endAt: "2026-09-25T11:00:00Z" }) as { id: string };
  const inbox = await space.execute("inbox.create", { title: "Prepare", body: "Bring notes", kind: "decision", source: { kind: "event", id: event.id } }) as { id: string; version: number };
  const resolved = await space.execute("inbox.resolve", { id: inbox.id, version: inbox.version }) as { resolvedAt: string | null };
  assert.ok(resolved.resolvedAt);
  const tasks = await space.execute("task.list", {}) as { items: unknown[] };
  assert.equal(tasks.items.length, 1);
  assert.ok(space.listActions("tasks").length >= 4);
  assert.ok(space.listActions(undefined, "日程").some((entry) => entry.action === "event.create"));
  const renamed = await space.execute("project.update", { id: project.id, version: project.version, name: "Bibo App" }) as { name: string; version: number };
  assert.equal(renamed.name, "Bibo App");
  await space.execute("project.delete", { id: project.id, version: renamed.version });
  const detached = await space.execute("task.get", { id: task.id }) as { projectId: string | null };
  assert.equal(detached.projectId, null);
});

test("parallel Agent tool calls keep both structured writes", async (t) => {
  const home = await mkdtemp(join(tmpdir(), "bibo-parallel-test-"));
  t.after(() => rm(home, { recursive: true, force: true }));
  await mkdir(join(home, "workspace"));
  const space = new BiboSpaceService(home);
  await Promise.all([
    space.execute("task.create", { title: "First" }, { kind: "agent", sessionId: "one" }),
    space.execute("task.create", { title: "Second" }, { kind: "agent", sessionId: "one" }),
  ]);
  const reopened = new BiboSpaceService(home);
  const tasks = await reopened.execute("task.list", {}) as { items: Array<{ title: string }> };
  assert.deepEqual(tasks.items.map((task) => task.title).sort(), ["First", "Second"]);
});

test("file operations cannot escape workspace or replace an unindexed file", async (t) => {
  const home = await mkdtemp(join(tmpdir(), "bibo-space-test-"));
  t.after(() => rm(home, { recursive: true, force: true }));
  await mkdir(join(home, "workspace"));
  await symlink(tmpdir(), join(home, "workspace", "escape"));
  const space = new BiboSpaceService(home);
  await assert.rejects(space.execute("file.create", { path: "../outside.md", kind: "note" }), (error: unknown) => error instanceof BiboSpaceError && error.status === 400);
  await assert.rejects(space.execute("file.create", { path: "escape", kind: "folder" }), (error: unknown) => error instanceof BiboSpaceError && error.status === 400);
});

test("NextClaw agent delivery appears in Bibo attention inbox with Bibo read state", async (t) => {
  const home = await mkdtemp(join(tmpdir(), "bibo-delivery-test-"));
  t.after(() => rm(home, { recursive: true, force: true }));
  await mkdir(join(home, "workspace"));
  await mkdir(join(home, "inbox"));
  await writeFile(join(home, "inbox", "deliveries.json"), JSON.stringify({ version: 2, deliveries: [{ id: "report-1", title: "Weekly brief", content: "# Report", contentType: "markdown", createdAt: instant, updatedAt: instant, readAt: null, archivedAt: null, source: { kind: "agent", sessionId: "chat-1" } }] }));
  const space = new BiboSpaceService(home);
  const list = await space.execute("inbox.list", {}) as { items: Array<{ id: string; source: { id: string }; version: number }> };
  assert.equal(list.items[0]?.id, "delivery:report-1");
  assert.equal(list.items[0]?.source.id, "chat-1");
  const item = await space.execute("inbox.read", { id: "delivery:report-1", version: 1 }) as { readAt: string | null };
  assert.ok(item.readAt);
  const reopened = new BiboSpaceService(home);
  const after = await reopened.execute("inbox.get", { id: "delivery:report-1" }) as { readAt: string | null };
  assert.equal(after.readAt, item.readAt);
});
