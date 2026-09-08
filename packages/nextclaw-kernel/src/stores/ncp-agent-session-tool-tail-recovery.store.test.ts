import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NcpEventType as E, type NcpEndpointEvent, type NcpMessage } from "@nextclaw/ncp";
import { DefaultNcpAgentConversationStateManager } from "@nextclaw/ncp-toolkit";
import { replayNcpAgentSessionEvents } from "@kernel/utils/ncp-agent-session-replay.utils.js";
import { NCP_AGENT_SESSION_MESSAGE_PROJECTION_VERSION } from "@kernel/utils/ncp-agent-session-message-projection.utils.js";
import { NcpAgentSessionJournalStore } from "./ncp-agent-session-journal.store.js";
import { NcpAgentSessionMessageProjectionPersistenceStore } from "./ncp-agent-session-message-projection-persistence.store.js";

const sessionId = "tool-rounds";
const messageId = "assistant-1";
const timestamp = "2026-09-08T14:00:00.000Z";
const user: NcpMessage = { id: "user-1", sessionId, role: "user", status: "final", timestamp, parts: [{ type: "text", text: "use tools" }] };
const assistant: NcpMessage = { id: messageId, sessionId, role: "assistant", status: "streaming", timestamp, parts: [] };
const run = { sessionId, messageId, runId: "run-1" };
let directory: string;
let store: NcpAgentSessionJournalStore;

async function setup() {
  directory = await mkdtemp(join(tmpdir(), "nextclaw-tool-tail-"));
  store = new NcpAgentSessionJournalStore(directory);
  await store.importSessionSnapshot({ sessionId, messages: [user], createdAt: timestamp, updatedAt: timestamp, metadata: {} });
}

function toolEvents(id: string): NcpEndpointEvent[] {
  return [
    { type: E.MessageToolCallStart, payload: { sessionId, messageId, toolCallId: id, toolName: "exec" } },
    { type: E.MessageToolCallArgs, payload: { sessionId, toolCallId: id, args: "{}" } },
    { type: E.MessageToolCallEnd, payload: { sessionId, toolCallId: id } },
    { type: E.MessageToolCallResult, payload: { sessionId, toolCallId: id, content: "ok", final: true } },
  ];
}

function multiRoundEvents(): NcpEndpointEvent[] {
  const events: NcpEndpointEvent[] = [{ type: E.RunStarted, payload: { ...run, startedAt: timestamp } }];
  const message = structuredClone(assistant);
  let count = 0;
  for (const [round, size] of [2, 1, 2, 2, 1, 1].entries()) {
    if (round >= 3) {
      events.push({ type: E.MessageTextStart, payload: run }, { type: E.MessageTextDelta, payload: { ...run, delta: "continue" } });
      message.parts.push({ type: "text", text: "continue" });
    }
    for (let index = 0; index < size; index++) {
      const toolCallId = `call-${++count}`;
      events.push(...toolEvents(toolCallId));
      message.parts.push({ type: "tool-invocation", toolCallId, toolName: "exec", state: "result", args: "{}", result: "ok" });
    }
    events.push({ type: E.MessageSent, payload: { sessionId, message: structuredClone(message) } });
  }
  message.parts.push({ type: "text", text: "done" });
  message.status = "final";
  events.push({ type: E.MessageCompleted, payload: { sessionId, message } }, { type: E.RunFinished, payload: { ...run, startedAt: timestamp, endedAt: "2026-09-08T14:01:00.000Z" } });
  return events;
}

afterEach(async () => {
  store?.close();
  if (directory) await rm(directory, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("tool ownership across journal checkpoints", () => {
  it("keeps live, incremental and full replay identical through six tool rounds and cold reload", async () => {
    await setup();
    const live = new DefaultNcpAgentConversationStateManager();
    live.hydrate({ sessionId, messages: [user] });
    const events: NcpEndpointEvent[] = [{ type: E.MessageSent, payload: { sessionId, message: user } }];
    for (const event of multiRoundEvents()) {
      events.push(event);
      await live.dispatch(event);
      await store.appendSessionEvent({ sessionId, event });
      if (event.type !== E.MessageSent && event.type !== E.MessageCompleted && event.type !== E.RunFinished) continue;
      const full = await replayNcpAgentSessionEvents(events);
      const page = await store.listSessionMessagePage({ sessionId, limit: 10 });
      expect(page?.messages).toEqual(full);
      const snapshot = live.getSnapshot();
      const liveMessages = snapshot.streamingMessage ? [...snapshot.messages, snapshot.streamingMessage] : snapshot.messages;
      expect(page?.messages).toEqual(liveMessages);
      expect(page?.messages.map(message => message.id)).toEqual([user.id, messageId]);
    }
    const cold = new NcpAgentSessionJournalStore(directory);
    try {
      const page = await cold.listSessionMessagePage({ sessionId, limit: 10 });
      expect(page?.total).toBe(2);
      expect(page?.messages[1].status).toBe("final");
      expect(page?.messages[1].parts.filter(part => part.type === "tool-invocation")).toHaveLength(9);
      expect(page?.messages).toEqual(await cold.listSessionMessages(sessionId));
    } finally { cold.close(); }
  });

  it.each([E.RunFinished, E.RunError, E.MessageAbort] as const)("does not resurrect %s messages from late starts, args or results", async (terminal) => {
    await setup();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const events: NcpEndpointEvent[] = [
      { type: E.RunStarted, payload: run },
      { type: E.MessageSent, payload: { sessionId, message: assistant } },
      { type: terminal, payload: run },
      ...toolEvents("late-call"),
    ];
    for (const event of events) await store.appendSessionEvent({ sessionId, event });
    const page = await store.listSessionMessagePage({ sessionId, limit: 10 });
    expect(page?.messages.map(message => message.id)).toEqual([user.id, messageId]);
    expect(page?.messages[1].status).toBe(terminal === E.RunError ? "error" : "final");
    expect(page?.messages[1].parts).toEqual([]);
    expect(await store.listSessionMessages(sessionId)).toEqual(page?.messages);
    expect(warn).toHaveBeenCalled();
  });

  it("attaches a late result to its known completed message across an incremental boundary", async () => {
    await setup();
    for (const event of multiRoundEvents()) await store.appendSessionEvent({ sessionId, event });
    await store.appendSessionEvent({ sessionId, event: { type: E.MessageToolCallResult, payload: { sessionId, toolCallId: "call-9", content: "late result", final: true } } });
    const page = await store.listSessionMessagePage({ sessionId, limit: 10 });
    expect(page?.total).toBe(2);
    expect(page?.messages[1].status).toBe("final");
    expect(page?.messages[1].parts).toContainEqual(expect.objectContaining({ toolCallId: "call-9", result: "late result" }));
    expect(page?.messages).toEqual(await store.listSessionMessages(sessionId));
  });

  it("rebuilds a corrupt version 7 projection without changing or executing journal events", async () => {
    await setup();
    for (const event of multiRoundEvents()) await store.appendSessionEvent({ sessionId, event });
    const journalPath = join(directory, `${sessionId}.jsonl`);
    const original = await readFile(journalPath, "utf-8");
    const persistence = new NcpAgentSessionMessageProjectionPersistenceStore(directory);
    await persistence.synchronize({
      sessionId,
      messages: [{ ...assistant, id: "tool-call-3", parts: [{ type: "tool-invocation", toolCallId: "call-3", toolName: "unknown", state: "result", result: "ok" }] }],
      projectedJournalOffset: Buffer.byteLength(original),
    });
    expect((await store.listSessionMessagePage({ sessionId, limit: 10 }))?.total).toBe(3);
    const projection = join(directory, ".message-projections", sessionId);
    const metaPath = join(projection, "meta.json");
    const meta = JSON.parse(await readFile(metaPath, "utf-8"));
    meta.version = 7;
    await writeFile(metaPath, JSON.stringify(meta));
    const page = await store.listSessionMessagePage({ sessionId, limit: 10 });
    expect(page?.total).toBe(2);
    expect(page?.messages).toEqual(await store.listSessionMessages(sessionId));
    expect(JSON.parse(await readFile(metaPath, "utf-8")).version).toBe(NCP_AGENT_SESSION_MESSAGE_PROJECTION_VERSION);
    expect(await readFile(journalPath, "utf-8")).toBe(original);
    expect(await store.listSessionMessagePage({ sessionId, limit: 10 })).toEqual(page);
  });
});
