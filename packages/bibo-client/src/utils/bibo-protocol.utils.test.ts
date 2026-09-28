import assert from "node:assert/strict";
import test from "node:test";
import { BiboClientError, readBiboStream, readMessages, readShowContent } from "./bibo-protocol.utils";

const encoder = new TextEncoder();
const committed = 'event: committed\ndata: {"text":"你好","messages":[{"role":"assistant","text":"你好","at":"now"}]}\n\n';

test("decodes split UTF-8 and CRLF frames before the stream finishes", async () => {
  const first = encoder.encode('event: delta\r\ndata: {"text":"你');
  const second = encoder.encode('好"}\r\n\r\n');
  const split = first.length - 1;
  const chunks = [first.slice(0, split), first.slice(split), second, encoder.encode(committed)];
  const events: string[] = [];
  const response = new Response(new ReadableStream<Uint8Array>({
    start: (controller) => { for (const chunk of chunks) controller.enqueue(chunk); controller.close(); },
  }), { headers: { "content-type": "text/event-stream" } });

  await readBiboStream(response, (event) => {
    if (event.name === "delta" || event.name === "committed") events.push(event.value.text);
  });
  assert.deepEqual(events, ["你好", "你好"]);
});

test("an uncommitted stream rejects even after visible delta", async () => {
  const response = new Response(new ReadableStream<Uint8Array>({
    start: (controller) => {
      controller.enqueue(encoder.encode('event: delta\ndata: {"text":"临时内容"}\n\n'));
      controller.close();
    },
  }));
  const events: string[] = [];
  await assert.rejects(readBiboStream(response, (event) => {
    if (event.name === "delta") events.push(event.value.text);
  }), BiboClientError);
  assert.deepEqual(events, ["临时内容"]);
});

test("server error frames reject with their message", async () => {
  const response = new Response(new ReadableStream<Uint8Array>({
    start: (controller) => {
      controller.enqueue(encoder.encode('event: error\ndata: {"error":"结果未能保存"}\n\n'));
      controller.close();
    },
  }));
  await assert.rejects(readBiboStream(response, () => undefined), /结果未能保存/);
});

test("invalid committed messages cannot report success", async () => {
  const response = new Response(new ReadableStream<Uint8Array>({
    start: (controller) => {
      controller.enqueue(encoder.encode('event: committed\ndata: {"text":"完成","messages":[{"role":"user"}]}\n\n'));
      controller.close();
    },
  }));
  await assert.rejects(readBiboStream(response, () => undefined), /对话记录格式不正确/);
});

test("question explanations, recommendations, and reply references survive history parsing", () => {
  const question = { id: "q1", title: "格式？", messageId: "m1", askedAt: "now", status: "answered", answer: "PDF",
    options: ["PDF", "DOCX"], recommendedOption: "PDF", optionDescriptions: { PDF: "便于交付" } };
  const messages = readMessages([
    { role: "assistant", text: "我继续整理", at: "now", questions: [question] },
    { role: "user", text: "PDF", at: "later", replyToQuestion: { id: "q1", title: "格式？", action: "answered" } },
  ]);
  assert.deepEqual(messages[0]?.questions?.[0], question);
  assert.deepEqual(messages[1]?.replyToQuestion, { id: "q1", title: "格式？", action: "answered" });
  assert.throws(() => readMessages([{ role: "assistant", text: "x", at: "now", questions: [{ ...question, recommendedOption: "TXT" }] }]), BiboClientError);
});
test("display events survive byte boundaries and retain the kernel file target", async () => {
  const value = { id: "tool:show", sessionId: "s1", title: "文档", target: { type: "file", payload: { path: "文档.md", viewer: "auto" } } };
  const bytes = new TextEncoder().encode(`event: show-content\ndata: ${JSON.stringify(value)}\n\nevent: committed\ndata: ${JSON.stringify({ text: "已保存", messages: [] })}\n\n`);
  let offset = 0;
  const response = new Response(new ReadableStream({ pull: (controller) => {
    if (offset === bytes.length) return controller.close();
    controller.enqueue(bytes.slice(offset, offset + 1)); offset++;
  } }));
  const events: unknown[] = [];
  await readBiboStream(response, (event) => events.push(event));
  assert.deepEqual(events[0], { name: "show-content", value });
  for (const invalid of [{ ...value, sessionId: "" }, { ...value, target: { type: "file", payload: { path: "a", viewer: "execute" } } }, { ...value, target: { type: "file", payload: null } }]) {
    assert.throws(() => readShowContent(invalid), BiboClientError);
  }
});
