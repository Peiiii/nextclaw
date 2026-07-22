import { describe, expect, it } from "vitest";
import {
  EventBus,
  Ingress,
  ingressKeys,
  type AgentRunSendIngressPayload,
} from "@nextclaw/shared";
import {
  NcpEventType,
  type NcpEndpointEvent,
  type NcpRunHandle,
} from "@nextclaw/ncp";
import { AgentRunRequestManager } from "@kernel/managers/agent-run-request.manager.js";
import type { AgentRuntime } from "@kernel/managers/agent-runtime.manager.js";
import { SessionRun } from "@kernel/managers/session-run.manager.js";

type StartedRun = { runId: string; sessionId: string; text: string };

async function waitForCondition(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function createDeferredRuntime(
  started: StartedRun[],
  completeRun: Map<string, () => void>,
) {
  return {
    run: async function* (
      spec: { runId: string },
      options: { sessionRun: SessionRun },
    ): AsyncGenerator<NcpEndpointEvent> {
      const { sessionRun } = options;
      const [message] = sessionRun.inbox.drain();
      started.push({
        runId: spec.runId,
        sessionId: sessionRun.sessionId,
        text: message?.parts[0]?.type === "text" ? message.parts[0].text : "",
      });
      const assistantMessageId = `assistant-${spec.runId}`;
      const startedEvent: NcpEndpointEvent = {
        type: NcpEventType.RunStarted,
        payload: {
          sessionId: sessionRun.sessionId,
          messageId: assistantMessageId,
          runId: spec.runId,
        },
      };
      await sessionRun.applyEvents([startedEvent]);
      yield startedEvent;
      await new Promise<void>((resolve) => {
        completeRun.set(spec.runId, resolve);
      });
      const messageCompletedEvent: NcpEndpointEvent = {
        type: NcpEventType.MessageCompleted,
        payload: {
          sessionId: sessionRun.sessionId,
          message: {
            id: assistantMessageId,
            sessionId: sessionRun.sessionId,
            role: "assistant",
            status: "final",
            timestamp: new Date().toISOString(),
            parts: [{ type: "text", text: "done" }],
          },
        },
      };
      const finishedEvent: NcpEndpointEvent = {
        type: NcpEventType.RunFinished,
        payload: {
          sessionId: sessionRun.sessionId,
          messageId: assistantMessageId,
          runId: spec.runId,
        },
      };
      await sessionRun.applyEvents([messageCompletedEvent, finishedEvent]);
      yield messageCompletedEvent;
      yield finishedEvent;
    },
  };
}

function createQueueManager(params: {
  completeRun: Map<string, () => void>;
  eventBus: EventBus;
  ingress: Ingress;
  runtime?: AgentRuntime;
  sessionRuns: Map<string, SessionRun>;
  started: StartedRun[];
}): AgentRunRequestManager {
  const { completeRun, eventBus, ingress, runtime, sessionRuns, started } = params;
  return new AgentRunRequestManager(
    {
      disposeRuntime: async () => undefined,
      getOrCreate: () => runtime ?? createDeferredRuntime(started, completeRun),
    } as never,
    { getDefaultAgentId: () => "main" } as never,
    {
      getDefaultModel: () => "test-model",
      getModelMaxTokens: () => 12000,
    } as never,
    { buildContext: async () => [] } as never,
    eventBus,
    ingress,
    {
      getOrCreateAgentRunSession: async ({ sessionId }: { sessionId?: string }) => ({
        sessionId: sessionId ?? "generated-session",
        agentId: "main",
        agentRuntimeId: "native",
        metadata: {},
        model: "test-model",
        thinkingEffort: null,
      }),
    } as never,
    {
      getSessionRun: (sessionId: string) => sessionRuns.get(sessionId) ?? null,
      getOrCreateSessionRun: async (sessionId: string) => {
        const run = sessionRuns.get(sessionId) ?? new SessionRun({ sessionId, messages: [] });
        sessionRuns.set(sessionId, run);
        return run;
      },
    } as never,
    { buildTools: async () => [] } as never,
  );
}

function createAbortThenFinishRuntime(started: StartedRun[]): AgentRuntime {
  return {
    run: async function* (spec, options): AsyncGenerator<NcpEndpointEvent> {
      const { sessionRun, signal } = options;
      const [message] = sessionRun.inbox.drain();
      const text = message?.parts[0]?.type === "text" ? message.parts[0].text : "";
      const messageId = `assistant-${spec.runId}`;
      started.push({ runId: spec.runId, sessionId: sessionRun.sessionId, text });
      const startedEvent: NcpEndpointEvent = {
        type: NcpEventType.RunStarted,
        payload: { sessionId: sessionRun.sessionId, messageId, runId: spec.runId },
      };
      await sessionRun.applyEvents([startedEvent]);
      yield startedEvent;
      if (text === "first") {
        await new Promise<void>((resolve) => {
          if (signal?.aborted) {
            resolve();
            return;
          }
          signal?.addEventListener("abort", () => resolve(), { once: true });
        });
        const abortEvent: NcpEndpointEvent = {
          type: NcpEventType.MessageAbort,
          payload: { sessionId: sessionRun.sessionId, messageId, runId: spec.runId },
        };
        await sessionRun.applyEvents([abortEvent]);
        yield abortEvent;
        return;
      }
      const errorEvent: NcpEndpointEvent = {
        type: NcpEventType.RunError,
        payload: {
          sessionId: sessionRun.sessionId,
          runId: spec.runId,
          error: "test terminal",
        },
      };
      await sessionRun.applyEvents([errorEvent]);
      yield errorEvent;
    },
  };
}

describe("AgentRunRequestManager session run queue", () => {
  it("serializes one session while allowing another session to run independently", async () => {
    const ingress = new Ingress();
    const eventBus = new EventBus();
    const sessionRuns = new Map<string, SessionRun>();
    const started: StartedRun[] = [];
    const completeRun = new Map<string, () => void>();
    const manager = createQueueManager({ completeRun, eventBus, ingress, sessionRuns, started });
    manager.start();

    const send = (sessionId: string, text: string) => ingress.handle<AgentRunSendIngressPayload, NcpRunHandle>({
      type: ingressKeys.agentRun.send,
      payload: { sessionId, content: [{ type: "text", text }] },
    }, { source: "test" });
    const first = await send("session-1", "first");
    await waitForCondition(() => started.length === 1);
    const second = await ingress.handle<AgentRunSendIngressPayload, NcpRunHandle>({
      type: ingressKeys.agentRun.send,
      payload: {
        sessionId: "session-1",
        content: [{ type: "text", text: "second" }],
        metadata: { requested_skill_refs: ["project:review"] },
      },
    }, { source: "test" });
    const other = await send("session-2", "other");
    await waitForCondition(() => started.length === 2);

    expect(first.runId).toEqual(expect.any(String));
    expect(second.runId).toBeNull();
    expect(other.runId).toEqual(expect.any(String));
    expect(started.map(({ sessionId, text }) => ({ sessionId, text }))).toEqual([
      { sessionId: "session-1", text: "first" },
      { sessionId: "session-2", text: "other" },
    ]);
    expect(manager.listQueuedInputs("session-1")).toMatchObject([
      {
        sessionId: "session-1",
        message: { parts: [{ type: "text", text: "second" }] },
        metadata: { requested_skill_refs: ["project:review"] },
      },
    ]);

    completeRun.get(first.runId as string)?.();
    await waitForCondition(() => started.length === 3);
    expect(started[2]).toMatchObject({ sessionId: "session-1", text: "second" });
    expect(manager.listQueuedInputs("session-1")).toEqual([]);

    completeRun.get(other.runId as string)?.();
    completeRun.get(started[2]?.runId ?? "")?.();
    manager.dispose();
  });

  it("removes a queued item only from its owning session", () => {
    const sessionRun = new SessionRun({ sessionId: "session-1", messages: [] });
    const queued = sessionRun.enqueueRequest({
      sessionId: "session-1",
      message: {
        id: "user-1",
        sessionId: "session-1",
        role: "user",
        status: "final",
        timestamp: new Date().toISOString(),
        parts: [{ type: "text", text: "queued" }],
      },
    }, {
      sessionId: "session-1",
      agentId: "main",
      agentRuntimeId: "native",
      metadata: {},
    });
    const manager = new AgentRunRequestManager(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      new EventBus(),
      new Ingress(),
      {} as never,
      { getSessionRun: (sessionId: string) => sessionId === "session-1" ? sessionRun : null } as never,
      {} as never,
    );

    expect(manager.removeQueuedInput("session-2", queued.id)).toBeNull();
    expect(manager.removeQueuedInput("session-1", queued.id)).toMatchObject({
      id: queued.id,
      sessionId: "session-1",
    });
    expect(manager.listQueuedInputs("session-1")).toEqual([]);
  });

  it("starts the next queued request after the active run is aborted", async () => {
    const ingress = new Ingress();
    const eventBus = new EventBus();
    const sessionRuns = new Map<string, SessionRun>();
    const started: StartedRun[] = [];
    const manager = createQueueManager({
      completeRun: new Map(),
      eventBus,
      ingress,
      runtime: createAbortThenFinishRuntime(started),
      sessionRuns,
      started,
    });
    manager.start();

    const send = (text: string) => ingress.handle<AgentRunSendIngressPayload, NcpRunHandle>({
      type: ingressKeys.agentRun.send,
      payload: { sessionId: "session-1", content: [{ type: "text", text }] },
    }, { source: "test" });
    const first = await send("first");
    await waitForCondition(() => started.length === 1);
    await send("second");

    await ingress.handle({
      type: ingressKeys.agentRun.abort,
      payload: { sessionId: "session-1", runId: first.runId ?? undefined },
    }, { source: "test" });
    await waitForCondition(() => started.length === 2);

    expect(started.map(({ text }) => text)).toEqual(["first", "second"]);
    expect(manager.listQueuedInputs("session-1")).toEqual([]);
    manager.dispose();
  });
});
