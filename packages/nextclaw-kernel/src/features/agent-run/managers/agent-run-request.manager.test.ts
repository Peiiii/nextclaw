import { describe, expect, it } from "vitest";
import {
  EventBus,
  Ingress,
  ingressKeys,
  type AgentRunSendIngressPayload,
} from "@nextclaw/shared";
import type { NcpEndpointEvent, NcpRunHandle } from "@nextclaw/ncp";
import { AgentRunRequestManager } from "./agent-run-request.manager.js";

describe("AgentRunRequestManager branch session creation", () => {
  it("uses the first user message as the new session task", async () => {
    const ingress = new Ingress();
    const createSessionCalls: Array<{ task?: string }> = [];
    const manager = new AgentRunRequestManager(
      {
        getOrCreate: () => ({
          run: async function* (): AsyncGenerator<NcpEndpointEvent> {},
        }),
      } as never,
      {
        getDefaultModel: () => "test-model",
        getModelMaxTokens: () => 12000,
        loadConfig: () => ({}),
      } as never,
      { buildContext: async () => [] } as never,
      new EventBus(),
      ingress,
      {
        createSession: async (params: { task?: string }) => {
          createSessionCalls.push(params);
          return {
            sessionId: "session-1",
            agentId: "main",
            agentRuntimeId: "native",
            metadata: {},
            model: "test-model",
            thinkingEffort: null,
          };
        },
      } as never,
      {
        getSessionRun: () => null,
        createSessionRun: async () => ({
          inbox: { enqueue: () => undefined },
          beginRun: () => ({ runId: "run-1", signal: new AbortController().signal }),
        }),
      } as never,
      { buildTools: async () => [] } as never,
    );
    manager.start();

    const handle = await ingress.handle<AgentRunSendIngressPayload, NcpRunHandle>({
      type: ingressKeys.agentRun.send,
      payload: {
        content: [{ type: "text", text: "用户的第一句话" }],
      },
    }, { source: "test" });

    expect(createSessionCalls[0]?.task).toBe("用户的第一句话");
    expect(handle.sessionId).toBe("session-1");
    manager.dispose();
  });
});
