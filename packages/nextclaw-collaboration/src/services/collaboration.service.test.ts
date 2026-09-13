import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CollaborationService } from "./collaboration.service.js";
import { CollaborationStore } from "../stores/collaboration.store.js";
import {
  createIdentity,
  identifyMessage,
  signMessage,
  isOwnOperation,
} from "../utils/identity.utils.js";
import type {
  CollaborationEvent,
  Connection,
  Consumer,
  ContextState,
  Execution,
  OutboxEntry,
  Run,
  SourceAdapter,
  StoredEvent,
} from "../types/collaboration.types.js";

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "collaboration-test-"));
  const store = new CollaborationStore(join(root, "state.sqlite"));
  cleanups.push(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  const agent = createIdentity(root, "alice");
  const peer = createIdentity(root, "bob");
  const connection: Connection = {
    id: "test",
    adapter: "test",
    options: {},
    source: "urn:test",
    account: "shared",
    agent,
    trustedAgents: [{ ...peer, account: "shared" }],
    allowedAccounts: ["shared"],
    consumer: { kind: "codex", workspace: root },
    enabled: true,
    since: "2026-01-01T00:00:00Z",
    intervalMs: 30_000,
    maxAgentHops: 4,
    maxRunsPerHour: 12,
  };
  store.put("connection", connection.id, connection);
  const messages: Array<{ id: string; body: string; account: string }> = [];
  const submissions: Execution[] = [];
  let creates = 0;
  let loseResponse = false;
  let quiet = false;
  const source: SourceAdapter = {
    id: "test",
    check: async () => ({
      source: "urn:test",
      account: "shared",
      writable: true,
      editableStatus: true,
    }),
    collect: async () => ({ events: [], checkpoint: "checkpoint" }),
    readContext: async (subject) => ({
      subject,
      title: "Test",
      url: "https://example.com/test",
      body: "Task",
      closed: false,
      invited: true,
      messages,
    }),
    reply: async (operation) => {
      const id = operation.existingId || String(messages.length + 1);
      const existing = messages.find((m) => m.id === id);
      if (existing) existing.body = operation.body;
      else messages.push({ id, body: operation.body, account: "shared" });
      if (loseResponse && operation.purpose === "reply") {
        loseResponse = false;
        throw new Error("response lost");
      }
      return id;
    },
    findReply: async (_subject, id) =>
      messages.find(
        (m) =>
          identifyMessage(m.body, "shared", "urn:test", "ticket", [
            { ...agent, account: "shared" },
          ]).operationId === id,
      )?.id,
  };
  const consumer: Consumer = {
    create: async () => `thread-${++creates}`,
    submit: async (threadId, requestId) => {
      const execution = { threadId, requestId, turnId: requestId };
      submissions.push(execution);
      return execution;
    },
    recover: async (_threadId, requestId) =>
      submissions.find((s) => s.requestId === requestId),
    inspect: async () => ({
      state: "completed",
      text: quiet ? "COLLABORATION_QUIET" : "Result",
    }),
    cancel: async () => {},
    close: async () => {},
  };
  const service = new CollaborationService(
    store,
    new Map([["test", source]]),
    new Map([["test", consumer]]),
  );
  const event = (
    id: string,
    body = "do task",
    account = "shared",
  ): CollaborationEvent => ({
    specversion: "1.0",
    source: "urn:test",
    subject: "ticket",
    type: "message",
    id,
    time: new Date().toISOString(),
    data: {
      resourceId: id,
      body,
      actor: { account },
      change: "message",
      invited: true,
    },
  });
  return {
    root,
    store,
    agent,
    peer,
    connection,
    service,
    source,
    consumer,
    messages,
    submissions,
    event,
    lose: () => {
      loseResponse = true;
    },
    quiet: () => {
      quiet = true;
    },
  };
}
describe("durable collaboration contract", () => {
  it("does not invoke a model for peer controls without control authority", async () => {
    const f = fixture();
    const body = signMessage(f.peer, "🤖[墨爪] /agent pause", {
      source: "urn:test",
      subject: "ticket",
      purpose: "reply",
      operationId: "control",
      hop: 0,
    });
    f.service.ingest(f.connection, f.event("peer-control", body));
    await f.service.dispatch();
    expect(f.submissions).toHaveLength(0);
    expect(f.store.list<StoredEvent>("event")[0].state).toBe("ignored");
  });
  it("stops collection and output when the authenticated source account changes", async () => {
    const f = fixture();
    f.service.ingest(f.connection, f.event("work"));
    await f.service.dispatch();
    await f.service.advance();
    f.source.check = async () => ({
      source: "urn:test",
      account: "different",
      writable: true,
      editableStatus: true,
    });
    await expect(f.service.collect(f.connection)).rejects.toThrow(
      "account or workspace changed",
    );
    await f.service.publish();
    expect(f.messages).toHaveLength(0);
    expect(
      f.store
        .list<OutboxEntry>("outbox")
        .find((e) => e.operation.purpose === "reply")?.state,
    ).toBe("pending");
  });
  it("keeps the full local result when a platform requires a shorter signed reply", async () => {
    const f = fixture();
    Object.assign(f.source, { maxMessageChars: 1200 });
    f.consumer.inspect = async () => ({
      state: "completed",
      text: "long result ".repeat(1000),
    });
    f.service.ingest(f.connection, f.event("long"));
    await f.service.dispatch();
    await f.service.advance();
    await f.service.publish();
    const reply = f.messages.find((m) => m.body.includes("完整结果见本地"))!;
    expect(reply.body.length).toBeLessThanOrEqual(1200);
    expect(
      identifyMessage(reply.body, "shared", "urn:test", "ticket", [
        { ...f.agent, account: "shared" },
      ]).agentId,
    ).toBe("alice");
    expect(f.store.list<Run>("run")[0].text?.length).toBe(12000);
  });
  it("cancels the active execution and keeps later work paused", async () => {
    const f = fixture();
    let cancelled = false;
    f.consumer.cancel = async () => {
      cancelled = true;
    };
    f.consumer.inspect = async () => ({
      state: cancelled ? "cancelled" : "running",
    });
    f.service.ingest(f.connection, f.event("work"));
    await f.service.dispatch();
    f.service.ingest(f.connection, f.event("cancel", "/agent cancel"));
    await f.service.dispatch();
    await f.service.advance();
    expect(cancelled).toBe(true);
    expect(f.store.list<Run>("run")[0].state).toBe("cancelled");
    expect(f.store.list<ContextState>("context")[0].paused).toBe(true);
  });
  it("ignores unchanged issue snapshots after output but accepts a later body revision", async () => {
    const f = fixture();
    f.service.ingest(f.connection, f.event("first"));
    await f.service.dispatch();
    await f.service.advance();
    const snapshot = f.event("updated-by-own-comment", "Task");
    snapshot.data.change = "context";
    f.service.ingest(f.connection, snapshot);
    await f.service.dispatch();
    expect(f.submissions).toHaveLength(1);
    f.service.ingest(f.connection, {
      ...snapshot,
      id: "body-edited",
      data: { ...snapshot.data, body: "Changed task" },
    });
    await f.service.dispatch();
    expect(f.submissions).toHaveLength(2);
  });
  it("reopens a closure pause while preserving a user's explicit pause", async () => {
    const f = fixture();
    f.service.ingest(f.connection, f.event("first"));
    await f.service.dispatch();
    await f.service.advance();
    const lifecycle = (id: string, change: "closed" | "context") => ({
      ...f.event(id, "Task"),
      data: { ...f.event(id, "Task").data, change },
    });
    f.service.ingest(f.connection, lifecycle("close", "closed"));
    await f.service.dispatch();
    expect(f.store.list<ContextState>("context")[0].paused).toBe(true);
    f.service.ingest(f.connection, lifecycle("reopen", "context"));
    await f.service.dispatch();
    expect(f.store.list<ContextState>("context")[0].paused).toBe(false);
    f.service.ingest(f.connection, f.event("pause", "/agent pause"));
    await f.service.dispatch();
    f.service.ingest(f.connection, lifecycle("close-again", "closed"));
    await f.service.dispatch();
    f.service.ingest(f.connection, lifecycle("reopen-again", "context"));
    await f.service.dispatch();
    expect(f.store.list<ContextState>("context")[0].paused).toBe(true);
    expect(f.submissions).toHaveLength(1);
  });
  it("requires a verified own signature and author to reconcile output", () => {
    const f = fixture();
    const body = signMessage(f.agent, "result", {
      source: "urn:test",
      subject: "ticket",
      purpose: "reply",
      operationId: "op",
      hop: 0,
    });
    expect(isOwnOperation(f.connection, "ticket", body, "shared", "op")).toBe(
      true,
    );
    expect(
      isOwnOperation(
        f.connection,
        "ticket",
        body.replace("result", "forged"),
        "shared",
        "op",
      ),
    ).toBe(false);
    expect(isOwnOperation(f.connection, "ticket", body, "other", "op")).toBe(
      false,
    );
    expect(
      isOwnOperation(f.connection, "different", body, "shared", "op"),
    ).toBe(false);
  });
  it("deduplicates input, reports started before result, and continues the same thread", async () => {
    const f = fixture();
    const input = f.event("first");
    f.service.ingest(f.connection, input);
    f.service.ingest(f.connection, input);
    await f.service.dispatch();
    await f.service.publish();
    expect(f.submissions).toHaveLength(1);
    expect(f.messages[0].body).toContain("已开始处理");
    await f.service.advance();
    await f.service.publish();
    f.service.ingest(f.connection, f.event("second"));
    await f.service.dispatch();
    expect(f.submissions.map((s) => s.threadId)).toEqual([
      "thread-1",
      "thread-1",
    ]);
  });
  it("same-account peers communicate while own messages, statuses and forged signatures cannot wake", async () => {
    const f = fixture();
    const signed = (
      who: typeof f.agent,
      purpose: "reply" | "status",
      hop = 0,
    ) =>
      signMessage(who, "hello", {
        source: "urn:test",
        subject: "ticket",
        operationId: "op",
        purpose,
        hop,
      });
    f.service.ingest(f.connection, f.event("own", signed(f.agent, "reply")));
    f.service.ingest(f.connection, f.event("status", signed(f.peer, "status")));
    f.service.ingest(
      f.connection,
      f.event("forged", signed(f.peer, "reply").replace("hello", "evil")),
    );
    f.service.ingest(f.connection, f.event("peer", signed(f.peer, "reply")));
    await f.service.dispatch();
    expect(f.submissions).toHaveLength(1);
    expect(
      f.store.list<StoredEvent>("event").filter((e) => e.state === "ignored"),
    ).toHaveLength(3);
  });
  it("rejects unauthorized input and stops agent loops at a code-enforced hop limit", async () => {
    const f = fixture();
    f.service.ingest(f.connection, f.event("stranger", "task", "stranger"));
    f.service.ingest(
      f.connection,
      f.event(
        "loop",
        signMessage(f.peer, "reply", {
          source: "urn:test",
          subject: "ticket",
          operationId: "loop",
          purpose: "reply",
          hop: 4,
        }),
      ),
    );
    await f.service.dispatch();
    expect(f.submissions).toHaveLength(0);
    expect(f.store.list<ContextState>("context")[0].paused).toBe(true);
  });
});

describe("execution recovery and control", () => {
  it("quiet has observable completion without a result comment", async () => {
    const f = fixture();
    f.quiet();
    f.service.ingest(f.connection, f.event("quiet"));
    await f.service.dispatch();
    await f.service.publish();
    await f.service.advance();
    await f.service.publish();
    expect(f.messages).toHaveLength(1);
    expect(f.messages[0].body).toContain("已安静处理");
  });
  it("processes pause ahead of queued work and resume retains pending input", async () => {
    const f = fixture();
    f.service.ingest(f.connection, f.event("work"));
    f.service.ingest(f.connection, f.event("pause", "/agent pause"));
    await f.service.dispatch();
    expect(f.submissions).toHaveLength(0);
    f.service.ingest(f.connection, f.event("resume", "/agent resume"));
    await f.service.dispatch();
    expect(f.submissions).toHaveLength(1);
  });
  it("recovers lost output responses by operation identity instead of posting twice", async () => {
    const f = fixture();
    f.service.ingest(f.connection, f.event("work"));
    await f.service.dispatch();
    await f.service.advance();
    f.lose();
    await f.service.publish();
    await f.service.publish();
    expect(f.messages.filter((m) => m.body.includes("Result"))).toHaveLength(1);
    expect(
      f.store
        .list<OutboxEntry>("outbox")
        .filter((e) => e.operation.purpose === "reply")[0].state,
    ).toBe("sent");
  });
  it("recovers accepted runs across coordinator restart, never blindly resubmits unknown work", async () => {
    const f = fixture();
    f.service.ingest(f.connection, f.event("work"));
    await f.service.dispatch();
    const run = f.store.list<Run>("run")[0];
    run.state = "submitting";
    delete run.execution!.turnId;
    f.store.put("run", run.id, run);
    await f.service.advance();
    expect(f.submissions).toHaveLength(1);
    expect(f.store.get<Run>("run", run.id)?.state).toBe("completed");
    f.store.put("run", "lost", { ...run, id: "lost", state: "submitting" });
    await f.service.advance();
    expect(f.store.get<Run>("run", "lost")?.state).toBe("unknown");
    expect(f.submissions).toHaveLength(1);
  });
  it("rolls back a failed receive transaction and enforces a single host lease", () => {
    const f = fixture();
    expect(() =>
      f.store.transaction(() => {
        f.service.ingest(f.connection, f.event("one"));
        throw new Error("crash");
      }),
    ).toThrow();
    expect(f.store.list("event")).toHaveLength(0);
    expect(f.store.lease("a", 100)).toBe(true);
    expect(f.store.lease("b", 101)).toBe(false);
    expect(f.store.lease("b", 60_101)).toBe(true);
  });
});
