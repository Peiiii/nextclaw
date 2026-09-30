import assert from "node:assert/strict";
import test, { type TestContext, type Mock } from "node:test";
import type { BiboInboxItem } from "@nextclaw/bibo-client";
import type { useBiboSpaceStore as BiboSpaceStoreHook } from "./bibo-space.store";


test("space lifecycle isolates accounts, preserves failed drafts and safely resumes file tabs", async (t) => {
  const originalWindow = globalThis.window;
  globalThis.window = { location: { search: "" } } as unknown as Window & typeof globalThis;
  t.after(() => { globalThis.window = originalWindow; });
  const responses: Array<(response: Response) => void> = [];
  const requests: Array<{ action: string; input: Record<string, unknown> }> = [];
  const fetchMock = t.mock.method(globalThis, "fetch", (_url: unknown, init: RequestInit) => {
    requests.push(JSON.parse(init.body as string));
    return new Promise<Response>((resolve) => responses.push(resolve));
  });
  const { useBiboSpaceStore } = await import("./bibo-space.store");
  useBiboSpaceStore.getState().bindAccount("first");
  useBiboSpaceStore.getState().keepEventDraft("new", { title: "private draft", description: "", startAt: "", endAt: "", version: null });
  useBiboSpaceStore.getState().bindAccount("second");
  assert.deepEqual(useBiboSpaceStore.getState().eventDrafts, {});
  const overview = (count: number) => ({ inbox: [], tasks: [], events: [], notes: [], projects: [], counts: { unread: count, activeTasks: 0 } });
  responses[1]!(Response.json({ result: overview(2) }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  responses[0]!(Response.json({ result: overview(99) }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(useBiboSpaceStore.getState().accountId, "second");
  assert.equal(useBiboSpaceStore.getState().overview?.counts.unread, 2);
  useBiboSpaceStore.getState().bindAccount(null);
  assert.equal(useBiboSpaceStore.getState().overview, null);

  const store = useBiboSpaceStore.getState();
  await t.test("failed create keeps its draft and retry id while duplicate clicks are ignored", async () => {
  const draft = { title: "保留这份草稿", description: "", startAt: "2026-09-25T10:00", endAt: "2026-09-25T11:00", version: null };
  store.keepEventDraft("new", draft);
  const firstSave = store.act("event.create", draft, "chat");
  assert.equal(await store.act("event.create", draft, "chat"), null);
  assert.equal(requests.length, 3, "duplicate click does not issue a second request");
  responses[2]!(Response.json({ error: "response lost" }, { status: 503 }));
  assert.equal(await firstSave, null);
  assert.equal(useBiboSpaceStore.getState().actionError, "response lost");
  assert.equal(useBiboSpaceStore.getState().error, "", "write failure belongs to its form, not the page read state");
  assert.deepEqual(useBiboSpaceStore.getState().eventDrafts.new, draft);
  const retry = store.act("event.create", draft, "chat");
  assert.equal(requests[3]!.input.requestId, requests[2]!.input.requestId);
  responses[3]!(Response.json({ result: { id: "event-saved" } }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  responses[4]!(Response.json({ result: overview(0) }));
  assert.deepEqual(await retry, { id: "event-saved" });
  assert.equal(useBiboSpaceStore.getState().saving, false);

  });

  await t.test("restored neighbor loads and stale opens cannot steal selection", async () => {
  useBiboSpaceStore.setState({ tabs: ["first-file", "restored-file"], activeFileId: "first-file", fileDetails: {} });
  store.closeFile("first-file");
  assert.equal(requests[5]!.action, "file.get");
  assert.equal(requests[5]!.input.id, "restored-file");
  responses[5]!(Response.json({ result: { id: "restored-file", path: "restored.md", kind: "document", version: 1, content: "restored content", uri: "nextclaw://objects/file/restored-file", createdAt: "now", updatedAt: "now" } }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(useBiboSpaceStore.getState().fileDetails["restored-file"]?.content, "restored content");

  const file = (id: string, version = 1) => ({ id, path: `${id}.md`, kind: "document", version, content: "saved content", uri: `nextclaw://objects/file/${id}`, createdAt: "now", updatedAt: "now" });
  const slow = store.openFile("slow");
  const slowResponse = responses.at(-1)!;
  const fast = store.openFile("fast");
  responses.at(-1)!(Response.json({ result: file("fast") }));
  await fast;
  slowResponse(Response.json({ result: file("slow") }));
  await slow;
  assert.equal(useBiboSpaceStore.getState().activeFileId, "fast", "late open cannot steal selection");

  });

  await t.test("dirty close needs explicit discard and saving prevents premature close", async () => {
  const file = (id: string, version = 1) => ({ id, path: `${id}.md`, kind: "document", version, content: "saved content" });
  store.editFile("slow", "new content");
  store.closeFile("slow");
  assert.equal(useBiboSpaceStore.getState().fileDrafts.slow?.content, "new content");
  const saving = store.saveFile("slow");
  const savedResponse = responses.at(-1)!;
  store.closeFile("slow");
  assert.equal(useBiboSpaceStore.getState().fileDrafts.slow?.saving, true);
  savedResponse(Response.json({ result: file("slow", 2) }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  responses.at(-1)!(Response.json({ result: { items: [file("fast"), file("slow", 2)], nextCursor: null } }));
  await saving;
  store.closeFile("slow");
  assert.equal(useBiboSpaceStore.getState().fileDrafts.slow, undefined);
  assert.equal(useBiboSpaceStore.getState().tabs.includes("slow"), false);
  });

  await t.test("conflict recovery keeps drafts through repeated conflicts and read failure, and guards close during recovery", async () => {
    const latest = { id: "fast", path: "fast.md", kind: "document", version: 2, content: "remote edit" };
    store.editFile("fast", "local edit");
    const save = store.saveFile("fast");
    responses.at(-1)!(Response.json({ error: "version conflict" }, { status: 409 }));
    await save;
    assert.equal(useBiboSpaceStore.getState().fileDrafts.fast?.conflict, true);
    const overwrite = store.resolveFileConflict("fast", "overwrite");
    responses.at(-1)!(Response.json({ result: latest }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(requests.at(-1)?.input.version, 2, "overwrite still uses the latest expected version");
    responses.at(-1)!(Response.json({ error: "changed again" }, { status: 409 }));
    await overwrite;
    assert.equal(useBiboSpaceStore.getState().fileDrafts.fast?.content, "local edit");
    assert.equal(useBiboSpaceStore.getState().fileDrafts.fast?.conflict, true);
    const unavailable = store.resolveFileConflict("fast", "reload");
    responses.at(-1)!(Response.json({ error: "unavailable" }, { status: 503 }));
    await unavailable;
    assert.equal(useBiboSpaceStore.getState().fileDrafts.fast?.saving, false);
    assert.equal(useBiboSpaceStore.getState().fileDrafts.fast?.content, "local edit");
    const opening = store.resolveFileConflict("fast", "reload");
    const response = responses.at(-1)!;
    store.closeFile("fast");
    assert.equal(useBiboSpaceStore.getState().fileDrafts.fast?.content, "local edit");
    response(Response.json({ result: latest }));
    await opening;
    assert.equal(useBiboSpaceStore.getState().fileDrafts.fast?.content, "remote edit");
    store.editFile("fast", "discarded change");
    store.closeFile("fast", true);
    assert.equal(useBiboSpaceStore.getState().fileDrafts.fast, undefined);
    assert.equal(useBiboSpaceStore.getState().fileDetails.fast, undefined);
  });
  await t.test("workspace selection and closing survive late file responses", async () => {
    const first = store.openWorkspace("workspace-first");
    const firstResponse = responses.at(-1)!;
    const second = store.openWorkspace("workspace-second");
    const secondResponse = responses.at(-1)!;
    secondResponse(Response.json({ result: { id: "workspace-second", path: "second.md", kind: "artifact", version: 1, content: "second" } }));
    await second;
    store.closeWorkspace();
    firstResponse(Response.json({ result: { id: "workspace-first", path: "first.md", kind: "artifact", version: 1, content: "first" } }));
    await first;
    assert.equal(useBiboSpaceStore.getState().workspaceOpen, false, "late response cannot reopen a closed workspace");
    assert.equal(useBiboSpaceStore.getState().workspaceFileId, "workspace-second", "late response cannot replace the last selection");
  });
  await t.test("note pagination ignores duplicate clicks and a superseded page", async () => {
    useBiboSpaceStore.setState({ notes: [], cursors: { notes: "100" }, moreLoading: {} });
    const before = requests.length;
    const first = store.loadMore("notes");
    await store.loadMore("notes");
    assert.equal(requests.length, before + 1);
    assert.deepEqual(requests.at(-1), { action: "file.list", input: { limit: 100, cursor: "100", kind: "note", query: "", sort: "recent" } });
    assert.equal(useBiboSpaceStore.getState().moreLoading.notes, true);
    responses.at(-1)!(Response.json({ result: { items: [{ id: "note-a", kind: "note" }], nextCursor: null } }));
    await first;
    assert.equal(useBiboSpaceStore.getState().notes[0]?.id, "note-a");
    assert.equal(useBiboSpaceStore.getState().moreLoading.notes, false);

    useBiboSpaceStore.setState({ cursors: { notes: "next" } });
    const stale = store.loadMore("notes");
    useBiboSpaceStore.setState({ notes: [], cursors: { notes: null } });
    responses.at(-1)!(Response.json({ result: { items: [{ id: "stale-note" }], nextCursor: null } }));
    await stale;
    assert.deepEqual(useBiboSpaceStore.getState().notes, []);
  });
  await t.test("verified source reuses its read and refreshes only clean file drafts", async () => {
    const file = { id: "source-file", path: "source.md", kind: "document" as const, content: "latest", version: 3, createdAt: "2026-09-25T09:00:00Z", updatedAt: "2026-09-25T09:00:00Z" };
    useBiboSpaceStore.setState({ fileDetails: { [file.id]: { ...file, content: "old", version: 2 } }, fileDrafts: { [file.id]: { content: "old", version: 2, dirty: false, saving: false } } });
    const before = requests.length;
    await store.openFile(file.id, file);
    assert.equal(requests.length, before, "verified root file does not fetch its detail twice");
    assert.equal(useBiboSpaceStore.getState().fileDrafts[file.id]?.content, "latest");
    assert.equal(useBiboSpaceStore.getState().fileDrafts[file.id]?.version, 3);
    store.editFile(file.id, "local change");
    await store.openFile(file.id, { ...file, content: "newer", version: 4 });
    assert.equal(useBiboSpaceStore.getState().fileDrafts[file.id]?.content, "local change", "verified read keeps a dirty draft");
  });
  await t.test("read failure never becomes an empty page and an older failure cannot replace recovery", async () => {
    const failed = store.load("inbox");
    assert.equal(useBiboSpaceStore.getState().readStatus.inbox, "loading");
    responses.at(-1)!(Response.json({ error: "temporarily unavailable" }, { status: 503 }));
    assert.equal(await failed, false);
    assert.equal(useBiboSpaceStore.getState().readStatus.inbox, "error");

    const stale = store.load("inbox");
    const staleResponse = responses.at(-1)!;
    const retry = store.load("inbox");
    responses.at(-1)!(Response.json({ result: { items: [], nextCursor: null } }));
    assert.equal(await retry, true);
    staleResponse(Response.json({ error: "old failure" }, { status: 503 }));
    await stale;
    assert.equal(useBiboSpaceStore.getState().readStatus.inbox, "ready");
    assert.equal(useBiboSpaceStore.getState().error, "");
  });
  await t.test("task feedback waits only for persistence and stale lists cannot erase the saved row", async () => {
    useBiboSpaceStore.setState({ tasks: [], taskScope: "all", taskQuery: "", taskProject: "", cursors: { tasks: null } });
    const stale = store.load("tasks");
    const projectsResponse = responses.at(-2)!;
    const listResponse = responses.at(-1)!;
    const before = requests.length;
    const save = store.act("task.create", { title: "立即保存" }, "tasks");
    assert.equal(useBiboSpaceStore.getState().feedback.message, "", "no saved announcement before persistence acknowledges");
    const saved = { id: "fast-task", title: "立即保存", description: "", status: "planned", projectId: null, dueAt: null, updatedAt: "2026-09-27T09:00:00Z", version: 1 };
    responses.at(-1)!(Response.json({ result: saved }));
    assert.deepEqual(await save, saved);
    assert.equal(requests.length, before + 1, "no container-backed overview refresh is queued behind a save");
    assert.equal(useBiboSpaceStore.getState().saving, false);
    assert.equal(useBiboSpaceStore.getState().tasks[0]?.id, saved.id);
    assert.equal(useBiboSpaceStore.getState().feedback.message, "任务已保存：立即保存");
    projectsResponse(Response.json({ result: { items: [], nextCursor: null } }));
    listResponse(Response.json({ result: { items: [], nextCursor: null } }));
    await stale;
    assert.equal(useBiboSpaceStore.getState().tasks[0]?.id, saved.id);

    useBiboSpaceStore.setState({ taskScope: "today", selectedTaskId: saved.id, taskSelection: saved as never,
      taskUndo: { id: saved.id, version: 1, status: "active", title: saved.title } });
    const complete = store.act("task.update", { id: saved.id, version: 1, status: "done" }, "tasks");
    responses.at(-1)!(Response.json({ result: { ...saved, status: "done", version: 2 } }));
    await complete;
    assert.deepEqual(useBiboSpaceStore.getState().tasks, [], "completed tasks leave the current open-task filter");
    assert.equal(useBiboSpaceStore.getState().feedback.task?.id, saved.id, "a saved task outside the filter remains available for contextual feedback");
    assert.equal(useBiboSpaceStore.getState().taskSelection?.version, 2);
    assert.equal(useBiboSpaceStore.getState().taskUndo, null, "another successful edit invalidates the older undo version");
  });
  await t.test("a task response for the previous account cannot become current-account saved feedback", async () => {
    const save = store.act("task.create", { title: "Previous account" }, "tasks");
    const response = responses.at(-1)!;
    useBiboSpaceStore.getState().bindAccount("third");
    response(Response.json({ result: { id: "private-task" } }));
    assert.equal(await save, null);
    assert.deepEqual(useBiboSpaceStore.getState().tasks, []);
    assert.equal(useBiboSpaceStore.getState().feedback.message, "");
    assert.equal(useBiboSpaceStore.getState().actionError, "");
  });
  await checkMissingFileWarning(t, useBiboSpaceStore, requests, responses);
  await checkWriteFeedback(t, responses, overview);
  await checkPreviewProtection(t, useBiboSpaceStore, requests);
  await checkNoteRestoration(t, useBiboSpaceStore, responses);
  await checkInboxRead(t, useBiboSpaceStore, fetchMock);
  await checkNewNote(useBiboSpaceStore, fetchMock);
});

async function checkNoteRestoration(t: TestContext, useBiboSpaceStore: typeof BiboSpaceStoreHook,
  responses: Array<(response: Response) => void>): Promise<void> {
  await t.test("note restoration stays in its collection and background workspace reads never select a document", async () => {
    const current = useBiboSpaceStore.getState();
    const note = { id: "note.md", path: "note.md", kind: "note", version: "v1", content: "saved", uri: "nextclaw://objects/file/note.md", createdAt: "now", updatedAt: "now" };
    const artifact = { ...note, id: "diagram.md", path: "diagram.md", kind: "artifact" };
    useBiboSpaceStore.setState({ view: "notes", activeFileId: artifact.id, tabs: [artifact.id], fileDetails: {}, fileDrafts: {}, fileBrowserVisible: true, workspaceOpen: true, workspaceFileId: artifact.id });
    const load = current.load("notes");
    responses.at(-2)!(Response.json({ result: { items: [note, artifact], nextCursor: null } }));
    responses.at(-1)!(Response.json({ result: { items: [note], nextCursor: null } }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    responses.at(-1)!(Response.json({ result: artifact }));
    await load;
    assert.equal(useBiboSpaceStore.getState().fileBrowserVisible, true);
    assert.equal(useBiboSpaceStore.getState().fileDrafts[artifact.id]?.dirty, false);
    await current.openFile(note.id, note as never);
    assert.equal(useBiboSpaceStore.getState().activeFileId, note.id);
    assert.equal(useBiboSpaceStore.getState().fileBrowserVisible, false);
    await current.openFile(artifact.id, undefined, false);
    assert.equal(useBiboSpaceStore.getState().activeFileId, note.id);
    assert.equal(useBiboSpaceStore.getState().fileBrowserVisible, false);
    current.editFile(note.id, "saved");
    assert.equal(useBiboSpaceStore.getState().fileDrafts[note.id]?.dirty, false, "initialization is not an edit");
    current.editFile(note.id, "changed");
    assert.equal(useBiboSpaceStore.getState().fileDrafts[note.id]?.dirty, true);
    current.editFile(note.id, "saved");
    assert.equal(useBiboSpaceStore.getState().fileDrafts[note.id]?.dirty, false, "undoing all changes releases the unload guard");
    current.closeFile(note.id);
    assert.equal(useBiboSpaceStore.getState().fileBrowserVisible, true, "closing the last note returns to its collection");
    assert.deepEqual(useBiboSpaceStore.getState().tabs, [artifact.id], "other module tabs are preserved");
  });
}

async function checkPreviewProtection(t: TestContext, useBiboSpaceStore: typeof BiboSpaceStoreHook,
  requests: readonly unknown[]): Promise<void> {
  await t.test("partial file previews cannot be edited or saved over the original", async () => {
    const current = useBiboSpaceStore.getState();
    const file = { id: "large", path: "large.txt", kind: "artifact" as const, content: "prefix", version: "v1",
      uri: "nextclaw://objects/file/large", createdAt: "now", updatedAt: "now",
      preview: { totalBytes: 100 * 1024 * 1024, readBytes: 6, truncated: true, binary: false } };
    useBiboSpaceStore.setState({ fileDetails: { large: file },
      fileDrafts: { large: { content: "prefix", version: "v1", dirty: false, saving: false } } });
    current.editFile("large", "overwrite");
    assert.equal(useBiboSpaceStore.getState().fileDrafts.large?.content, "prefix");
    useBiboSpaceStore.setState({ fileDrafts: { large: { content: "prefix", version: "v1", dirty: true, saving: false } } });
    const before = requests.length;
    await current.saveFile("large");
    assert.equal(requests.length, before);
  });
}

async function checkMissingFileWarning(t: TestContext, useBiboSpaceStore: typeof BiboSpaceStoreHook,
  requests: Array<{ action: string; input: Record<string, unknown> }>, responses: Array<(response: Response) => void>): Promise<void> {
  await t.test("a missing restored file cannot leave a deletion warning on another file", async () => {
    const current = useBiboSpaceStore.getState();
    const real = { id: "real-file", path: "工作台/周报.md", kind: "document", version: 1, content: "still here", createdAt: "now", updatedAt: "now" };
    useBiboSpaceStore.setState({ tabs: ["missing-file", real.id], activeFileId: real.id, workspaceOpen: true, workspaceFileId: "missing-file", fileDetails: { [real.id]: real as never }, fileDrafts: {}, error: "", fileOpenError: null });
    const load = current.load("files");
    responses.at(-1)!(Response.json({ result: { items: [real], nextCursor: null } }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(requests.at(-1)?.action, "file.get");
    assert.equal(requests.at(-1)?.input.id, "missing-file");
    responses.at(-1)!(Response.json({ error: "对象不存在或已删除。" }, { status: 404 }));
    await load;
    const restored = useBiboSpaceStore.getState();
    assert.deepEqual(restored.tabs, [real.id]);
    assert.equal(restored.workspaceFileId, real.id);
    assert.equal(restored.error, "");
    assert.equal(restored.fileOpenError, null);

    const failed = current.openFile("old-list-row");
    responses.at(-1)!(Response.json({ error: "对象不存在或已删除。" }, { status: 404 }));
    await failed;
    assert.equal(useBiboSpaceStore.getState().fileOpenError?.id, "old-list-row");
    await current.openFile(real.id);
    assert.equal(useBiboSpaceStore.getState().fileOpenError, null);
    assert.equal(useBiboSpaceStore.getState().error, "");
  });
}


async function checkWriteFeedback(t: TestContext, responses: Array<(response: Response) => void>, overview: (count: number) => unknown): Promise<void> {
  const { useBiboSpaceStore } = await import("./bibo-space.store");
  useBiboSpaceStore.getState().bindAccount(null, true);
  const store = useBiboSpaceStore.getState();
  await t.test("file failures stay with their draft and a later edit cannot be reported as saved", async () => {
    const file = { id: "feedback-file", path: "feedback.md", kind: "document", version: 1, content: "original" };
    await store.openFile(file.id, file as never);
    store.editFile(file.id, "submitted");
    useBiboSpaceStore.setState({ error: "independent read error" });
    const failed = store.saveFile(file.id);
    responses.at(-1)!(Response.json({ error: "write unavailable" }, { status: 503 }));
    await failed;
    assert.equal(useBiboSpaceStore.getState().fileDrafts[file.id]?.error, "write unavailable");
    assert.equal(useBiboSpaceStore.getState().fileDrafts.fast?.error, undefined);
    assert.equal(useBiboSpaceStore.getState().error, "independent read error");
    assert.equal(useBiboSpaceStore.getState().fileDrafts[file.id]?.dirty, true);
    const retry = store.saveFile(file.id);
    const response = responses.at(-1)!;
    assert.equal(useBiboSpaceStore.getState().fileDrafts[file.id]?.error, undefined);
    store.editFile(file.id, "typed during save");
    response(Response.json({ result: { ...file, content: "submitted", version: 2 } }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    responses.at(-1)!(Response.json({ result: { items: [file], nextCursor: null } }));
    await retry;
    const draft = useBiboSpaceStore.getState().fileDrafts[file.id]!;
    assert.equal(draft.content, "typed during save");
    assert.equal(draft.version, 2);
    assert.equal(draft.dirty, true);
    assert.equal(draft.saving, false);
  });
  await t.test("a refresh failure after commit remains a read warning rather than a failed write", async () => {
    const saved = { id: "new-project", name: "committed" };
    const save = store.act("project.create", { name: saved.name }, "tasks");
    responses.at(-1)!(Response.json({ result: saved }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    responses.at(-2)!(Response.json({ result: { items: [], nextCursor: null } }));
    responses.at(-1)!(Response.json({ error: "read unavailable" }, { status: 503 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    responses.at(-1)!(Response.json({ result: overview(0) }));
    assert.deepEqual(await save, saved);
    assert.equal(useBiboSpaceStore.getState().actionError, "");
    assert.equal(useBiboSpaceStore.getState().error, "操作已保存，视图暂未刷新。请重试读取。");
    assert.equal(useBiboSpaceStore.getState().readStatus.tasks, "error");
  });
}


async function checkInboxRead(t: TestContext, useBiboSpaceStore: typeof BiboSpaceStoreHook, fetchMock: Mock<typeof fetch>): Promise<void> {
  const item = (id: string): BiboInboxItem => ({ id, title: id, body: "body", kind: "agent", source: { kind: "bibo" }, createdAt: "now", updatedAt: "now", readAt: null, resolvedAt: null, version: 1 });
  const items = [item("one"), item("two"), item("retry"), item("filtered"), item("previous-account")];
  const writes: Array<{ id: string; resolve: (response: Response) => void }> = [];
  fetchMock.mock.mockImplementation((_url: unknown, init?: RequestInit) => {
    const { action, input } = JSON.parse(init!.body as string);
    if (action === "inbox.read") return new Promise<Response>(resolve => writes.push({ id: input.id, resolve }));
    const result = action === "overview.get" ? { inbox: items, tasks: [], events: [], notes: [], projects: [], counts: { unread: items.filter(entry => !entry.readAt).length, activeTasks: 0 } }
      : action === "inbox.get" ? items.find(entry => entry.id === input.id) : { items, nextCursor: null };
    return Promise.resolve(Response.json({ result }));
  });
  useBiboSpaceStore.getState().bindAccount("inbox-reader");
  await new Promise(resolve => setTimeout(resolve, 0));
  const owner = useBiboSpaceStore.getState();
  useBiboSpaceStore.setState({ inbox: items.map(entry => ({ ...entry })), inboxScope: "pending" });
  const acknowledge = (id: string) => {
    const saved = items.find(entry => entry.id === id)!;
    saved.readAt = "2026-09-30T00:00:00Z"; saved.version++;
    writes.findLast(write => write.id === id)!.resolve(Response.json({ result: saved }));
  };
  await t.test("rapid selection marks each visible message once and retains the newest reader", async () => {
    owner.inboxReader.select("one"); owner.inboxReader.select("one"); owner.inboxReader.select("two");
    assert.deepEqual(writes.map(write => write.id), ["one", "two"]);
    assert.equal(useBiboSpaceStore.getState().inbox[0]?.readAt, null, "read state only changes after persistence acknowledges");
    acknowledge("two"); acknowledge("one");
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(useBiboSpaceStore.getState().selectedInboxId, "two");
    assert.equal(useBiboSpaceStore.getState().inboxSelection?.readAt, items[1]!.readAt);
    assert.equal(useBiboSpaceStore.getState().overview?.counts.unread, 3);
    owner.inboxReader.select("one");
    assert.equal(writes.length, 2, "reopening a read message does not write again");
  });
  await t.test("write failure retains unread state and permits explicit retry", async () => {
    owner.inboxReader.select("retry");
    writes.at(-1)!.resolve(Response.json({ error: "read failed" }, { status: 503 }));
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(useBiboSpaceStore.getState().inboxReadError?.message, "read failed");
    assert.equal(useBiboSpaceStore.getState().inbox.find(entry => entry.id === "retry")?.readAt, null);
    const retry = owner.inboxReader.read(useBiboSpaceStore.getState().inboxSelection!);
    acknowledge("retry"); await retry;
    assert.equal(useBiboSpaceStore.getState().inboxReadError, null);
    assert.equal(useBiboSpaceStore.getState().inboxReading.retry, undefined);
  });
  await t.test("an unread filter removes the saved row while retaining its reader", async () => {
    useBiboSpaceStore.setState({ inboxScope: "unread" });
    owner.inboxReader.select("filtered");
    acknowledge("filtered");
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(useBiboSpaceStore.getState().inbox.some(entry => entry.id === "filtered"), false);
    assert.equal(useBiboSpaceStore.getState().inboxSelection?.id, "filtered");
    assert.ok(useBiboSpaceStore.getState().inboxSelection?.readAt);
  });
  await t.test("a stale account response cannot update the active reader", async () => {
    owner.inboxReader.select("previous-account");
    useBiboSpaceStore.getState().bindAccount("next-reader");
    acknowledge("previous-account");
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(useBiboSpaceStore.getState().selectedInboxId, null);
    assert.equal(useBiboSpaceStore.getState().inboxSelection, null);
    assert.deepEqual(useBiboSpaceStore.getState().inboxReading, {});
  });
}

async function checkNewNote(useBiboSpaceStore: typeof BiboSpaceStoreHook, fetchMock: Mock<typeof fetch>): Promise<void> {
  await test("new note opens immediately, retries authoritative name conflicts and ignores duplicate clicks", async () => {
  useBiboSpaceStore.getState().bindAccount(null, true);
  useBiboSpaceStore.setState({ view: "notes" });
  const created: string[] = [];
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  fetchMock.mock.mockImplementation( async (_url: unknown, init: RequestInit) => {
    const { action, input } = JSON.parse(init.body as string);
    if (action !== "file.create") return Response.json({ result: { items: [], nextCursor: null } });
    created.push(input.path);
    if (created.length === 1) { await wait; return Response.json({ error: "name conflict" }, { status: 409 }); }
    return Response.json({ result: { id: "new-note", ...input, version: 1, createdAt: "now", updatedAt: "now" } });
  });
  const creating = useBiboSpaceStore.getState().createNote();
  assert.equal(await useBiboSpaceStore.getState().createNote(), false);
  release();
  assert.equal(await creating, true);
  assert.deepEqual(created, ["无标题笔记.md", "无标题笔记 2.md"]);
  assert.equal(useBiboSpaceStore.getState().activeFileId, "new-note");
  assert.equal(useBiboSpaceStore.getState().fileBrowserVisible, false);
  assert.equal(useBiboSpaceStore.getState().fileDrafts["new-note"]?.content, "# 无标题笔记 2\n\n");
  assert.equal(useBiboSpaceStore.getState().saving, false);
  const retries: string[] = [];
  let unavailable = true;
  fetchMock.mock.mockImplementation(async (_url: unknown, init: RequestInit) => {
    const { action, input } = JSON.parse(init.body as string);
    if (action !== "file.create") return Response.json({ result: { items: [], nextCursor: null } });
    retries.push(input.requestId);
    return unavailable ? Response.json({ error: "暂时无法创建" }, { status: 503 })
      : Response.json({ result: { id: "recovered-note", ...input, version: 1, createdAt: "now", updatedAt: "now" } });
  });
  assert.equal(await useBiboSpaceStore.getState().createNote(), false);
  assert.equal(useBiboSpaceStore.getState().actionError, "暂时无法创建");
  assert.equal(useBiboSpaceStore.getState().saving, false);
  unavailable = false;
  assert.equal(await useBiboSpaceStore.getState().createNote(), true);
  assert.equal(retries[0], retries[1], "retry keeps the idempotency key after an uncertain failure");
  assert.equal(useBiboSpaceStore.getState().activeFileId, "recovered-note");
});
}
