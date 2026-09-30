import assert from "node:assert/strict";
import test from "node:test";
import type { NcpLLMApi, NcpMessage } from "@nextclaw/ncp";
import { createQuestionMessage, createQuestionResolutionMessage, projectUserQuestions } from "@nextclaw/kernel";
import { projectBiboConversation } from "../utils/bibo-session.utils";
import { BiboSpaceStateStore } from "../bibo-space-state.service";
import { BiboConversationService } from "./bibo-conversation.service";
import { BiboSpaceActionService } from "./bibo-edge-space.service";
import { BiboEdgeSessionStore } from "../stores/bibo-edge-session.store";
import { CloudflareSessionStore } from "../stores/cloudflare-session.store";
import { BiboExecutionService } from "./bibo-execution.service";
import type { getSandbox, Sandbox } from "@cloudflare/sandbox";
import type { WorkspaceByteStore, WorkspaceEntry } from "@nextclaw/kernel";
import type { BiboWorkspaceFileService } from "./bibo-workspace-file.service.js";

function memoryWorkspace() {
  const files = new Map<string, Uint8Array>();
  const directories = new Set(["/data/workspace"]);
  let revision = 0;
  const versions = new Map<string, string>();
  const resolve = (path: string) => {
    const value = path === "." || path === "/data/workspace" ? "/data/workspace" : path.startsWith("/data/workspace/")
      ? path : `/data/workspace/${path}`;
    if (value.split("/").includes("..")) throw new Error("Path outside workspace");
    return value;
  };
  const entry = (path: string): WorkspaceEntry | null => directories.has(path)
    ? { path, kind: "directory", version: "dir", bytes: 0, mediaType: null }
    : files.has(path) ? { path, kind: "file", version: versions.get(path)!, bytes: files.get(path)!.length,
      mediaType: "text/plain" } : null;
  const workspace: WorkspaceByteStore & { mountPrefix(path: string): Promise<string> } = {
    resolve,
    stat: async (path) => entry(resolve(path)),
    list: async (path) => directories.has(resolve(path))
      ? { entries: [...files.keys(), ...directories].filter((item) =>
        item !== resolve(path) && item.startsWith(`${resolve(path)}/`) &&
        !item.slice(resolve(path).length + 1).includes("/")).map((item) => entry(item)!),
        nextCursor: null } : null,
    read: async (path, range) => {
      const target = resolve(path);
      const bytes = files.get(target);
      if (!bytes) return null;
      const sliced = bytes.subarray(range?.offset ?? 0, range?.length === undefined
        ? undefined : (range.offset + range.length));
      return { entry: entry(target)!, body: new Blob([new Uint8Array(sliced)]).stream() };
    },
    write: async (path, body, options) => {
      const target = resolve(path);
      if (options?.expectedVersion !== undefined && entry(target)?.version !== options.expectedVersion) {
        throw new Error("Workspace file version has changed");
      }
      files.set(target, new Uint8Array(await new Response(body).arrayBuffer()));
      versions.set(target, String(++revision));
      return entry(target)!;
    },
    mkdir: async (path) => { const target = resolve(path); directories.add(target); return entry(target)!; },
    move: async (path, destination) => {
      const source = resolve(path);
      const target = resolve(destination);
      files.set(target, files.get(source)!);
      files.delete(source);
      versions.set(target, String(++revision));
      return entry(target)!;
    },
    remove: async (path) => { files.delete(resolve(path)); },
    mountPrefix: async (path) => `/user/workspace/${resolve(path).slice("/data/workspace/".length)}`,
  };
  return { workspace, files };
}

function fileService(workspace: WorkspaceByteStore): Pick<BiboWorkspaceFileService, "workspace" | "executeSpace"> {
  return { workspace: workspace as BiboWorkspaceFileService["workspace"],
    executeSpace: (space, action, input, actor) => space.execute(action, input, actor) };
}

function createConversation(storage: DurableObjectStorage, state: BiboSpaceStateStore,
  model: NcpLLMApi, summary: ConstructorParameters<typeof BiboConversationService>[3],
  files: Pick<BiboWorkspaceFileService, "workspace" | "executeSpace">) {
  return new BiboConversationService(storage, new BiboSpaceActionService(storage, state, files), model, summary, files);
}

class MemoryStorage {
  values = new Map<string, unknown>();
  reads: string[] = [];
  private transactions: Promise<void> = Promise.resolve();
  get = async (key: string | string[]) => Array.isArray(key)
    ? new Map(key.filter((item) => { this.reads.push(item); return this.values.has(item); })
      .map((item) => [item, structuredClone(this.values.get(item))]))
    : (this.reads.push(key), structuredClone(this.values.get(key)));
  list = async ({ prefix = "" }: { prefix?: string } = {}) => new Map([...this.values]
    .filter(([key]) => key.startsWith(prefix)).map(([key, value]) => [key, structuredClone(value)]));
  put = async (key: string, value: unknown) => { this.values.set(key, structuredClone(value)); };
  delete = async (key: string) => { this.values.delete(key); };
  transaction = <T>(run: (transaction: unknown) => Promise<T>): Promise<T> => {
    const task = this.transactions.then(() => this.transact(run));
    this.transactions = task.then(() => undefined, () => undefined);
    return task;
  };
  private transact = async <T>(run: (transaction: unknown) => Promise<T>): Promise<T> => {
    const next = new Map(this.values);
    const result = await run({
      get: async (key: string | string[]) => Array.isArray(key)
        ? new Map(key.filter((id) => next.has(id)).map((id) => [id, structuredClone(next.get(id))])) : structuredClone(next.get(key)),
      list: async ({ prefix = "" } = {}) => new Map([...next].filter(([key]) => key.startsWith(prefix)).sort(([a], [b]) => a.localeCompare(b))),
      put: async (entries: Record<string, unknown>) => { for (const [key, value] of Object.entries(entries)) next.set(key, structuredClone(value)); },
      delete: async (keys: string[]) => { for (const key of keys) next.delete(key); },
    });
    this.values = next;
    return result;
  };
}

for (const workspaceRoot of ["/data/workspace", "/data/workspace/agents/custom"])
for (const memoryEnabled of [true, false]) test(`public Harness uses persisted context settings (workspace=${workspaceRoot}, memory=${memoryEnabled})`, async () => {
  const storage = new MemoryStorage();
  storage.values.set("agentConfig", { agents: {
    defaults: { workspace: workspaceRoot, model: "openai/gpt-5", contextTokens: 200_000 },
    context: { memory: { enabled: memoryEnabled }, bootstrap: { files: ["AGENTS.md", "SOUL.md", "BOOT.md", "CUSTOM.md"],
      minimalFiles: ["AGENTS.md"], perFileChars: 4000, totalChars: 12000 } },
  } });
  storage.values.set("ncpSession:bootstrap", { version: 1, messageIds: [], metadata: {
    last_context_compaction: { version: 1, id: "checkpoint", status: "compressed", summary: "Previous context.",
      coveredMessageCount: 0, coveredSessionMessageCount: 0, originalEstimatedTokens: 20_000,
      projectedEstimatedTokens: 100, createdAt: "2026-09-29T00:00:00.000Z", updatedAt: "2026-09-29T00:00:00.000Z" },
  } });
  const { workspace, files } = memoryWorkspace();
  for (const [name, content] of [["AGENTS.md", "a".repeat(10_000)], ["SOUL.md", "Be concise."],
    ["BOOT.md", "FIRST_USE_ONLY"], ["CUSTOM.md", "CUSTOM_PROFILE_RULE"], ["memory/MEMORY.md", "PERSISTENT_MEMORY_RULE"]]) {
    files.set(`${workspaceRoot}/${name}`, new TextEncoder().encode(content));
  }
  if (workspaceRoot !== "/data/workspace") files.set("/data/workspace/CUSTOM.md", new TextEncoder().encode("WRONG_WORKSPACE_CONTENT"));
  let called = false;
  const service = createConversation(storage as unknown as DurableObjectStorage,
    new BiboSpaceStateStore(storage as unknown as DurableObjectStorage), {
      generate: async function* (input) {
        called = true;
        const content = JSON.stringify(input.messages);
        assert.match(content, /CUSTOM_PROFILE_RULE/);
        assert.equal(content.includes("WRONG_WORKSPACE_CONTENT"), false);
        assert.match(content, /truncated 6000 chars/);
        assert.match(content, /embody its persona/);
        assert.match(content, /OpenAI\/Codex Execution Discipline/);
        assert.match(content, /## Safety/);
        assert.equal(content.includes("PERSISTENT_MEMORY_RULE"), memoryEnabled);
        assert.match(content, /Model: openai\/gpt-5/);
        assert.match(content, /Host: Cloudflare Worker/);
        assert.equal(content.includes("FIRST_USE_ONLY"), false);
        assert.equal(content.includes("a".repeat(4001)), false);
        yield { id: "reply", choices: [{ index: 0, delta: { content: "ready" }, finish_reason: "stop" }] };
      },
    }, { chat: async () => { throw new Error("unexpected compaction"); } }, fileService(workspace));
  try {
    await service.run({ sessionId: "bootstrap", message: "hello", runId: "bootstrap-run" });
    assert.equal(called, true);
  } finally { await service.dispose(); }
});

test("one Harness isolates concurrent session tools and context and survives checkpoints", async () => {
  const storage = new MemoryStorage();
  const calls = new Map<string, number>();
  const executed: string[] = [];
  const service = createConversation(storage as unknown as DurableObjectStorage,
    new BiboSpaceStateStore(storage as unknown as DurableObjectStorage), {
      generate: async function* (input, options) {
        const id = options?.sessionId;
        assert.ok(id === "scope-a" || id === "scope-b");
        const other = id === "scope-a" ? "scope-b" : "scope-a";
        assert.ok(JSON.stringify(input.messages).includes(`context:${id}`));
        assert.equal(JSON.stringify(input.messages).includes(`context:${other}`), false);
        assert.ok(input.tools?.some((tool) => tool.function.name === id));
        assert.equal(input.tools?.some((tool) => tool.function.name === other), false);
        const count = (calls.get(id) ?? 0) + 1;
        calls.set(id, count);
        if (count === 1) {
          yield { id: `call-${id}`, choices: [{ index: 0, delta: { tool_calls: [{ index: 0,
            id: `tool-${id}`, function: { name: id, arguments: "{}" } }] }, finish_reason: "tool_calls" }] };
        } else yield { id: `reply-${id}-${count}`, choices: [{ index: 0, delta: { content: `reply:${id}` }, finish_reason: "stop" }] };
      },
    }, { chat: async () => { throw new Error("unexpected compaction"); } }, fileService(memoryWorkspace().workspace));
  const run = (id: string) => service.run({ sessionId: id, message: "hello", runId: `run-${id}`,
    contextBlocks: [`context:${id}`], tools: [{ name: id, description: id,
      modelParameters: { type: "object", properties: {}, additionalProperties: false },
      validateArgs: (value) => Object.keys(value).length ? ["No arguments accepted"] : [],
      execute: async () => { executed.push(id); return { ok: true }; } }] });
  try {
    await Promise.all([run("scope-a"), run("scope-b")]);
    assert.deepEqual(executed.sort(), ["scope-a", "scope-b"]);
    await service.commit("scope-a", {});
    await service.commit("scope-b", {});
    await run("scope-a");
    await service.commit("scope-a", {});
    assert.equal(storage.reads.filter((key) => key === "agentConfig").length, 1, "platform starts once across turns");
    const reopened = new CloudflareSessionStore(storage as unknown as DurableObjectStorage);
    for (const id of ["scope-a", "scope-b"]) {
      const messages = await reopened.listSessionMessages(id);
      assert.equal(new Set(messages.map((message) => message.id)).size, messages.length);
      assert.equal(messages.filter((message) => message.role === "user").length, id === "scope-a" ? 2 : 1);
    }
  } finally { await service.dispose(); }
});

test("canonical UI history preserves more than 100 messages and omits failed assistant output", () => {
  const messages: NcpMessage[] = Array.from({ length: 120 }, (_, index) => ({
    id: `m-${index}`, sessionId: "history", role: index % 2 ? "assistant" : "user", status: "final",
    timestamp: new Date(index).toISOString(), parts: [{ type: "text", text: `message ${index}` }],
  }));
  messages.push({ id: "failed", sessionId: "history", role: "assistant", status: "error", timestamp: new Date().toISOString(),
    parts: [{ type: "text", text: "unfinished answer" }] });
  const projected = projectBiboConversation(messages);
  assert.equal(projected.length, 120);
  assert.equal(projected[0]?.text, "message 0");
  assert.equal(projected.at(-1)?.text, "message 119");
});

test("canonical UI projection preserves question choices and the quoted answer across reload", () => {
  const created = createQuestionMessage("questions", [{ title: "Which day?", options: ["Monday", "Tuesday"] }]);
  const question = projectUserQuestions([created.message])[0]!;
  const resolution = createQuestionResolutionMessage("questions", question, "answer", "Tuesday");
  const projected = projectBiboConversation([created.message, resolution]);
  assert.equal(projected[0]?.questions?.[0]?.status, "answered");
  assert.deepEqual(projected[0]?.questions?.[0]?.options, ["Monday", "Tuesday"]);
  assert.equal(projected[1]?.text, "Tuesday");
  assert.deepEqual(projected[1]?.replyToQuestion, { id: question.id, title: question.title, action: "answered" });
});

test("session listing reads indexes without loading every persisted message", async () => {
  const storage = new MemoryStorage();
  const sessions = new CloudflareSessionStore(storage as unknown as DurableObjectStorage);
  await sessions.importSessionSnapshot({ sessionId: "old", updatedAt: "2026-09-29T00:00:00Z", messages: [
    { id: "m1", sessionId: "old", role: "user", status: "final", timestamp: "2026-09-28T00:00:00Z", parts: [{ type: "text", text: "hello" }] },
  ] });
  storage.reads.length = 0;
  assert.equal((await new CloudflareSessionStore(storage as unknown as DurableObjectStorage).listSessionSummaries())[0]?.messageCount, 1);
  assert.equal(storage.reads.some((key) => key.startsWith("ncpMessage:")), false);
});

test("shared session-history tools read the current hosted NCP session", async () => {
  const storage = new MemoryStorage();
  let calls = 0;
  const edge = createConversation(storage as unknown as DurableObjectStorage,
    new BiboSpaceStateStore(storage as unknown as DurableObjectStorage),
    { generate: async function* (input) {
      calls += 1;
      const list = input.tools?.find((tool) => tool.function.name === "sessions_list");
      assert.ok(list?.function.parameters);
      assert.equal(input.tools?.some((tool) => tool.function.name === "sessions_history"), true);
      if (calls === 1) {
        yield { id: "list-call", choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: "list-1", function: {
          name: "sessions_list", arguments: JSON.stringify({ messageLimit: 1 }),
        } }] }, finish_reason: null }] };
        yield { id: "list-end", choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] };
      } else if (calls === 2) {
        assert.equal(JSON.stringify(input.messages).includes("session-history"), true);
        yield { id: "history-call", choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: "history-1", function: {
          name: "sessions_history", arguments: JSON.stringify({ sessionKey: "session-history" }),
        } }] }, finish_reason: null }] };
        yield { id: "history-end", choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] };
      } else {
        assert.equal(JSON.stringify(input.messages).includes("找出当前会话"), true);
        yield { id: "answer", choices: [{ index: 0, delta: { content: "找到了当前会话。" }, finish_reason: "stop" }] };
      }
    } }, { chat: async () => { throw new Error("unexpected compaction"); } }, fileService(memoryWorkspace().workspace));
  const result = await edge.run({ sessionId: "session-history", message: "找出当前会话", runId: "run-history", contextBlocks: [] });
  assert.equal(result.text, "找到了当前会话。");
  assert.equal(calls, 3);
  assert.equal(storage.values.has("sessions"), false, "running tools must not publish a successful UI turn");
  assert.equal((await new CloudflareSessionStore(storage as unknown as DurableObjectStorage).listUnfinishedRuns()).length, 0);
});

test("tool success persists its file before the conversation is published", async () => {
  const storage = new MemoryStorage();
  const store = new BiboSpaceStateStore(storage as unknown as DurableObjectStorage);
  let modelCalls = 0;
  const llmApi: NcpLLMApi = { generate: async function* (input) {
    modelCalls += 1;
    assert.equal(input.tools?.some((tool) => tool.function.name === "bibo"), true);
    assert.equal(input.tools?.some((tool) => tool.function.name === "tool_schema"), true);
    const biboSchema = input.tools?.find((tool) => tool.function.name === "bibo")?.function.parameters as { properties?: Record<string, unknown> } | undefined;
    const showFileSchema = input.tools?.find((tool) => tool.function.name === "show_file")?.function.parameters as { properties?: Record<string, unknown> } | undefined;
    assert.equal(biboSchema?.properties, undefined);
    assert.equal(showFileSchema?.properties, undefined);
    if (modelCalls <= 2) {
      if (modelCalls === 2) assert.match(JSON.stringify(input.messages), /operation/);
      yield { id: "schema-call", choices: [{ index: 0, delta: { tool_calls: [{ index: 0,
        id: `schema-${modelCalls}`, function: { name: "tool_schema",
          arguments: JSON.stringify({ name: modelCalls === 1 ? "bibo" : "show_file" }) },
      }] }, finish_reason: null }] };
      yield { id: "schema-end", choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] };
    } else if (modelCalls === 3) {
      assert.match(JSON.stringify(input.messages), /viewer/);
      yield { id: "tool-call", choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: "call-1", function: {
        name: "bibo", arguments: JSON.stringify({ operation: "call", action: "file.create", input: { path: "note.md", kind: "artifact", content: "saved" } }),
      } }] }, finish_reason: null }] };
      yield { id: "tool-end", choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] };
    } else if (modelCalls === 4) {
      assert.equal(JSON.stringify(input.messages).includes("saved"), true);
      yield { id: "show-call", choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: "call-2", function: {
        name: "show_file", arguments: JSON.stringify({ path: "/data/workspace/note.md", viewer: "source" }),
      } }] }, finish_reason: null }] };
      yield { id: "show-end", choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] };
    } else {
      yield { id: "answer", choices: [{ index: 0, delta: { content: "文件已保存。" }, finish_reason: "stop" }] };
    }
  } };
  const edge = createConversation(storage as unknown as DurableObjectStorage, store, llmApi,
    { chat: async () => { throw new Error("unexpected compaction"); } }, fileService(memoryWorkspace().workspace));
  const deltas: string[] = [];
  const result = await edge.run({ sessionId: "session-1", message: "创建一个文件", runId: "run-1", contextBlocks: ["You are Bibo."], onDelta: (delta) => deltas.push(delta) });
  assert.equal(result.text, "文件已保存。");
  assert.equal(deltas.join(""), result.text);
  assert.equal(modelCalls, 5);
  assert.equal(result.displayEvents.length, 1);
  assert.equal(result.displayEvents[0]?.target.type, "file");
  assert.equal([...storage.values.keys()].some((key) => key.startsWith("spaceFile:")), true, "successful file tools are durable before the final reply");
  assert.equal(storage.values.has("sessions"), false, "UI success remains uncommitted");
  assert.equal(result.ncpSession.messages.length, 2);
  await edge.commit("session-1", { sessions: [{ id: "session-1" }] });
  assert.equal((await new BiboEdgeSessionStore(storage as unknown as DurableObjectStorage).load("session-1"))?.messages.length, 2);
  assert.equal(storage.values.has("sessions"), true);
  assert.equal([...storage.values.keys()].some((key) => key.startsWith("spaceFile:")), true);
});

test("shared file tools write, read and edit one hosted workspace without a container", async () => {
  const storage = new MemoryStorage();
  const store = new BiboSpaceStateStore(storage as unknown as DurableObjectStorage);
  const { workspace, files } = memoryWorkspace();
  const calls = [
    { name: "write_file", args: { path: "draft.md", content: "first" } },
    { name: "read_file", args: { path: "draft.md" } },
    { name: "edit_file", args: { path: "draft.md", oldText: "first", newText: "second" } },
    { name: "read_file", args: { path: "draft.md" } },
  ];
  let turn = 0;
  const edge = createConversation(storage as unknown as DurableObjectStorage, store,
    { generate: async function* (input) {
      const current = calls[turn++];
      assert.equal(input.tools?.some((tool) => tool.function.name === "read_file"), true);
      if (current) {
        yield { id: `file-${turn}`, choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: `call-${turn}`,
          function: { name: current.name, arguments: JSON.stringify(current.args) } }] }, finish_reason: null }] };
        yield { id: `end-${turn}`, choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] };
      } else {
        assert.equal(JSON.stringify(input.messages).includes("second"), true);
        yield { id: "answer", choices: [{ index: 0, delta: { content: "已修改。" }, finish_reason: "stop" }] };
      }
    } }, { chat: async () => { throw new Error("unexpected compaction"); } }, fileService(workspace));
  const result = await edge.run({ sessionId: "file-session", message: "写入并修改", runId: "file-run", contextBlocks: [] });
  assert.equal(result.text, "已修改。");
  assert.equal(storage.values.has("sessions"), false);
  await edge.commit("file-session", {});
  assert.equal(new TextDecoder().decode(files.get("/data/workspace/draft.md")), "second");
});

test("one NCP conversation mounts a directory, executes in the temporary OS, then reads the same durable file", async () => {
  const storage = new MemoryStorage();
  const store = new BiboSpaceStateStore(storage as unknown as DurableObjectStorage);
  const { workspace, files } = memoryWorkspace();
  await workspace.write("plan.md", new Blob(["before"]).stream());
  let acquired = 0;
  let prefix = "";
  const sandbox = {
    mountBucket: async (_binding: string, _path: string, options: { prefix: string }) => { prefix = options.prefix; },
    startProcess: async (command: string, options: object) => {
      assert.equal("signal" in options, false);
      if (command === "change mounted plan") await workspace.write("plan.md", new Blob(["after"]).stream());
      return { id: "plan-command", waitForExit: async () => ({ exitCode: 0 }) };
    },
    getProcessLogs: async () => ({ stdout: "changed", stderr: "" }),
    killProcess: async () => {},
    destroy: async () => {},
  };
  const execution = new BiboExecutionService({} as DurableObjectNamespace<Sandbox>, crypto.randomUUID(),
    new AbortController().signal, workspace, storage as unknown as DurableObjectStorage,
    (() => { acquired += 1; return sandbox; }) as unknown as typeof getSandbox);
  const calls = [
    { name: "mount_directory", args: { path: "." } },
    { name: "exec", args: { command: "change mounted plan" } },
    { name: "read_file", args: { path: "plan.md" } },
  ];
  let turn = 0;
  const edge = createConversation(storage as unknown as DurableObjectStorage, store,
    { generate: async function* (input) {
      assert.equal(input.tools?.some((tool) => tool.function.name === "mount_directory"), true);
      const current = calls[turn++];
      if (current) {
        yield { id: `os-${turn}`, choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: `os-call-${turn}`,
          function: { name: current.name, arguments: JSON.stringify(current.args) } }] }, finish_reason: null }] };
        yield { id: `os-end-${turn}`, choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] };
      } else {
        assert.match(JSON.stringify(input.messages), /after/);
        yield { id: "answer", choices: [{ index: 0, delta: { content: "文件已更新。" }, finish_reason: "stop" }] };
      }
    } }, { chat: async () => { throw new Error("unexpected compaction"); } }, fileService(workspace));
  assert.equal(acquired, 0);
  const result = await edge.run({ sessionId: "os-session", message: "更新并读取文件", runId: crypto.randomUUID(),
    contextBlocks: [], createTools: () => execution.tools() });
  assert.equal(result.text, "文件已更新。");
  assert.equal(acquired, 1);
  assert.equal(prefix, "/user/workspace/");
  await edge.commit("os-session", {});
  assert.equal(new TextDecoder().decode(files.get("/data/workspace/plan.md")), "after");
  await execution.dispose();
});

test("failed run durably retains input and terminal error without publishing success", async () => {
  const storage = new MemoryStorage();
  const edge = createConversation(storage as unknown as DurableObjectStorage,
    new BiboSpaceStateStore(storage as unknown as DurableObjectStorage),
    { generate: async function* () { yield await Promise.reject(new Error("model unavailable")); } },
    { chat: async () => { throw new Error("unexpected compaction"); } }, fileService(memoryWorkspace().workspace));
  await assert.rejects(edge.run({ sessionId: "session-1", message: "hello", runId: "run-1", contextBlocks: [] }), { code: "RUN_FAILED", status: 503 });
  const persistence = new CloudflareSessionStore(storage as unknown as DurableObjectStorage);
  assert.equal(storage.values.has("sessions"), false);
  assert.equal([...storage.values.keys()].some((key) => key.startsWith("spaceFile:")), false);
  assert.deepEqual(await persistence.listUnfinishedRuns(), []);
  const messages = await persistence.listSessionMessages("session-1");
  assert.equal(messages.some((message) => message.role === "user" && JSON.stringify(message.parts).includes("hello")), true);
  assert.equal(messages.some((message) => message.role === "assistant" && message.status === "final"), false);
});

test("model quota failure remains a prompt 429 after the NCP runtime emits a run error", async () => {
  const storage = new MemoryStorage();
  const edge = createConversation(storage as unknown as DurableObjectStorage,
    new BiboSpaceStateStore(storage as unknown as DurableObjectStorage),
    { generate: async function* () { yield await Promise.reject(new Error("BIBO_MODEL_QUOTA_EXHAUSTED")); } },
    { chat: async () => { throw new Error("unexpected compaction"); } }, fileService(memoryWorkspace().workspace));
  await assert.rejects(edge.run({ sessionId: "session-1", message: "hello", runId: "run-1", contextBlocks: [] }),
    { code: "MODEL_RATE_LIMITED", status: 429 });
  assert.equal(storage.values.has("sessions"), false);
  assert.deepEqual(await new CloudflareSessionStore(storage as unknown as DurableObjectStorage).listUnfinishedRuns(), []);
});

test("edge questions use the same NCP extension and resolution metadata across turns", async () => {
  const storage = new MemoryStorage();
  let calls = 0;
  const edge = createConversation(storage as unknown as DurableObjectStorage,
    new BiboSpaceStateStore(storage as unknown as DurableObjectStorage),
    { generate: async function* (input) {
      calls += 1;
      if (calls === 1) {
        assert.equal(input.tools?.some((tool) => tool.function.name === "request_user_input_async"), true);
        yield { id: "before-question", choices: [{ index: 0, delta: { content: "先说明。" }, finish_reason: null }] };
        yield { id: "ask", choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: "ask-1", function: {
          name: "request_user_input_async", arguments: JSON.stringify({ questions: [{ title: "格式？", options: ["PDF", "DOCX"], recommendedOption: "PDF" }] }),
        } }] }, finish_reason: null }] };
        yield { id: "ask-end", choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] };
      } else {
        yield { id: `answer-${calls}`, choices: [{ index: 0, delta: { content: calls === 2 ? "请选格式。" : "已选择 DOCX。" }, finish_reason: "stop" }] };
      }
    } }, { chat: async () => { throw new Error("unexpected compaction"); } }, fileService(memoryWorkspace().workspace));
  const first = await edge.run({ sessionId: "question-session", message: "生成报告", runId: "run-1", contextBlocks: [] });
  assert.deepEqual(first.content.map((part) => part.type === "text" ? part.text : "question"), ["先说明。", "question", "请选格式。"]);
  assert.equal(first.text, "先说明。\n\n请选格式。");
  assert.equal(first.questions.length, 1);
  assert.equal(first.questions[0]?.status, "pending");
  await edge.commit("question-session", {});
  const second = await edge.run({ sessionId: "question-session", message: "DOCX", runId: "run-2", contextBlocks: [],
    question: { id: first.questions[0]!.id, action: "answer", answer: "DOCX" } });
  assert.equal(second.questions[0]?.status, "answered");
  assert.equal(second.questions[0]?.answer, "DOCX");
  assert.equal(second.ncpSession.messages.some((message) => message.metadata?.nextclaw_user_question_id === first.questions[0]?.id), true);
  await edge.commit("question-session", {});
  assert.equal((await new BiboEdgeSessionStore(storage as unknown as DurableObjectStorage).load("question-session"))?.messages.length, second.ncpSession.messages.length);
});
