import assert from "node:assert/strict";
import test from "node:test";

test("space lifecycle isolates accounts, preserves failed drafts and safely resumes file tabs", async (t) => {
  const originalWindow = globalThis.window;
  globalThis.window = { location: { search: "" } } as unknown as Window & typeof globalThis;
  t.after(() => { globalThis.window = originalWindow; });
  const responses: Array<(response: Response) => void> = [];
  const requests: Array<{ action: string; input: Record<string, unknown> }> = [];
  t.mock.method(globalThis, "fetch", (_url: unknown, init: RequestInit) => {
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
  responses[5]!(Response.json({ result: { id: "restored-file", path: "restored.md", kind: "document", version: 1, content: "restored content" } }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(useBiboSpaceStore.getState().fileDetails["restored-file"]?.content, "restored content");

  const file = (id: string, version = 1) => ({ id, path: `${id}.md`, kind: "document", version, content: "saved content" });
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
    assert.deepEqual(requests.at(-1), { action: "file.list", input: { limit: 100, cursor: "100", kind: "note", sort: "recent" } });
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
});
