import assert from "node:assert/strict";
import test from "node:test";
import type { NcpLLMApi } from "@nextclaw/ncp";
import { BiboSpaceStateStore } from "../bibo-space-state.service";
import { BiboEdgeConversationService } from "./bibo-edge-conversation.service";
import { BiboEdgeSessionStore } from "../stores/bibo-edge-session.store";

class MemoryStorage {
  values = new Map<string, unknown>();
  get = async (key: string | string[]) => Array.isArray(key)
    ? new Map(key.filter((item) => this.values.has(item)).map((item) => [item, structuredClone(this.values.get(item))]))
    : structuredClone(this.values.get(key));
  transaction = async (run: (transaction: unknown) => Promise<void>) => {
    const next = new Map(this.values);
    await run({
      get: async (key: string) => structuredClone(next.get(key)),
      put: async (entries: Record<string, unknown>) => { for (const [key, value] of Object.entries(entries)) next.set(key, structuredClone(value)); },
      delete: async (keys: string[]) => { for (const key of keys) next.delete(key); },
    });
    this.values = next;
  };
}

test("edge NCP tool turn stages a file and commits it with the full conversation", async () => {
  const storage = new MemoryStorage();
  const store = new BiboSpaceStateStore(storage as unknown as DurableObjectStorage);
  let modelCalls = 0;
  const llmApi: NcpLLMApi = { generate: async function* (input) {
    modelCalls += 1;
    assert.equal(input.tools?.some((tool) => tool.function.name === "bibo"), true);
    assert.equal(input.tools?.some((tool) => tool.function.name === "tool_schema"), false);
    const biboSchema = input.tools?.find((tool) => tool.function.name === "bibo")?.function.parameters as { properties?: Record<string, unknown> } | undefined;
    const showFileSchema = input.tools?.find((tool) => tool.function.name === "show_file")?.function.parameters as { properties?: Record<string, unknown> } | undefined;
    assert.ok(biboSchema?.properties?.operation);
    assert.ok(showFileSchema?.properties?.path);
    if (modelCalls === 1) {
      yield { id: "tool-call", choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: "call-1", function: {
        name: "bibo", arguments: JSON.stringify({ operation: "call", action: "file.create", input: { path: "note.md", kind: "artifact", content: "saved" } }),
      } }] }, finish_reason: null }] };
      yield { id: "tool-end", choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] };
    } else if (modelCalls === 2) {
      assert.equal(JSON.stringify(input.messages).includes("saved"), true);
      yield { id: "show-call", choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: "call-2", function: {
        name: "show_file", arguments: JSON.stringify({ path: "/data/workspace/note.md", viewer: "source" }),
      } }] }, finish_reason: null }] };
      yield { id: "show-end", choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] };
    } else {
      yield { id: "answer", choices: [{ index: 0, delta: { content: "文件已保存。" }, finish_reason: "stop" }] };
    }
  } };
  const edge = new BiboEdgeConversationService(storage as unknown as DurableObjectStorage, store, llmApi,
    { chat: async () => { throw new Error("unexpected compaction"); } });
  const deltas: string[] = [];
  const result = await edge.run({ sessionId: "session-1", message: "创建一个文件", runId: "run-1", contextBlocks: ["You are Bibo."], onDelta: (delta) => deltas.push(delta) });
  assert.equal(result.text, "文件已保存。");
  assert.equal(deltas.join(""), result.text);
  assert.equal(modelCalls, 3);
  assert.equal(result.displayEvents.length, 1);
  assert.equal(result.displayEvents[0]?.target.type, "file");
  assert.equal(storage.values.size, 0, "generation cannot leak a staged file or half-turn");
  assert.equal(result.ncpSession.messages.length, 2);
  await edge.commit("session-1", result, { sessions: [{ id: "session-1" }] });
  assert.equal((await new BiboEdgeSessionStore(storage as unknown as DurableObjectStorage).load("session-1"))?.messages.length, 2);
  assert.equal(storage.values.has("sessions"), true);
  assert.equal([...storage.values.keys()].some((key) => key.startsWith("spaceFile:")), true);
});

test("failed edge NCP run exposes no file or conversation state", async () => {
  const storage = new MemoryStorage();
  const edge = new BiboEdgeConversationService(storage as unknown as DurableObjectStorage,
    new BiboSpaceStateStore(storage as unknown as DurableObjectStorage),
    { generate: async function* () { yield await Promise.reject(new Error("model unavailable")); } },
    { chat: async () => { throw new Error("unexpected compaction"); } });
  await assert.rejects(edge.run({ sessionId: "session-1", message: "hello", runId: "run-1", contextBlocks: [] }), { code: "RUN_FAILED", status: 503 });
  assert.equal(storage.values.size, 0);
});

test("model quota failure remains a prompt 429 after the NCP runtime emits a run error", async () => {
  const storage = new MemoryStorage();
  const edge = new BiboEdgeConversationService(storage as unknown as DurableObjectStorage,
    new BiboSpaceStateStore(storage as unknown as DurableObjectStorage),
    { generate: async function* () { yield await Promise.reject(new Error("BIBO_MODEL_QUOTA_EXHAUSTED")); } },
    { chat: async () => { throw new Error("unexpected compaction"); } });
  await assert.rejects(edge.run({ sessionId: "session-1", message: "hello", runId: "run-1", contextBlocks: [] }),
    { code: "MODEL_RATE_LIMITED", status: 429 });
  assert.equal(storage.values.size, 0);
});

test("edge questions use the same NCP extension and resolution metadata across turns", async () => {
  const storage = new MemoryStorage();
  let calls = 0;
  const edge = new BiboEdgeConversationService(storage as unknown as DurableObjectStorage,
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
    } }, { chat: async () => { throw new Error("unexpected compaction"); } });
  const first = await edge.run({ sessionId: "question-session", message: "生成报告", runId: "run-1", contextBlocks: [] });
  assert.deepEqual(first.content.map((part) => part.type === "text" ? part.text : "question"), ["先说明。", "question", "请选格式。"]);
  assert.equal(first.text, "先说明。\n\n请选格式。");
  assert.equal(first.questions.length, 1);
  assert.equal(first.questions[0]?.status, "pending");
  await edge.commit("question-session", first, {});
  const second = await edge.run({ sessionId: "question-session", message: "DOCX", runId: "run-2", contextBlocks: [],
    question: { id: first.questions[0]!.id, action: "answer", answer: "DOCX" } });
  assert.equal(second.questions[0]?.status, "answered");
  assert.equal(second.questions[0]?.answer, "DOCX");
  assert.equal(second.ncpSession.messages.some((message) => message.metadata?.nextclaw_user_question_id === first.questions[0]?.id), true);
  await edge.commit("question-session", second, {});
  assert.equal((await new BiboEdgeSessionStore(storage as unknown as DurableObjectStorage).load("question-session"))?.messages.length, second.ncpSession.messages.length);
});
