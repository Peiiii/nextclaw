import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Config, SessionManager } from "@nextclaw/core";
import {
  NcpEventType,
  type NcpAgentSendEnvelope,
  type NcpAgentRunInput,
  type NcpAgentRuntime,
  type NcpEndpointEvent,
  type NcpRunHandle,
} from "@nextclaw/ncp";
import { InMemoryAgentSessionStore, type RuntimeFactoryParams } from "@nextclaw/ncp-toolkit";
import { EventBus, Ingress, ingressKeys } from "@nextclaw/shared";
import { AgentRunRequestManager } from "./agent-run-request.manager.js";
import type { AgentRuntimeManager } from "./agent-runtime.manager.js";

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-agent-run-request-manager-"));
  tempDirs.push(dir);
  return dir;
}

function createRuntimeManagerStub() {
  const runtimeInputs: NcpAgentRunInput[] = [];
  const runtimeFactoryParams: RuntimeFactoryParams[] = [];
  const runtimeManager = {
    createRuntime: vi.fn((params: RuntimeFactoryParams): NcpAgentRuntime => {
      runtimeFactoryParams.push(params);
      return {
        run: async function* (input: NcpAgentRunInput): AsyncGenerator<NcpEndpointEvent> {
          runtimeInputs.push(input);
          yield {
            type: NcpEventType.RunStarted,
            payload: {
              sessionId: input.sessionId,
              messageId: "assistant-message-1",
              runId: "run-1",
            },
          };
        },
      };
    }),
    listSessionTypes: vi.fn(() => ({ defaultType: "native", options: [] })),
  } as Pick<AgentRuntimeManager, "createRuntime" | "listSessionTypes">;
  return {
    runtimeFactoryParams,
    runtimeInputs,
    runtimeManager: runtimeManager as AgentRuntimeManager,
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("AgentRunRequestManager", () => {
  it("materializes raw send envelopes before runtime execution", async () => {
    const ingress = new Ingress();
    const sessions = new SessionManager({ sessionsDir: createTempDir() });
    const {
      runtimeFactoryParams,
      runtimeInputs,
      runtimeManager,
    } = createRuntimeManagerStub();
    const onSessionUpdated = vi.fn();
    const manager = new AgentRunRequestManager({
      sessions,
      ingress,
      agentRuntimeManager: runtimeManager,
      ncpAgentSessionStore: new InMemoryAgentSessionStore(),
      configManager: { loadConfig: () => ({}) as Config },
      eventBus: new EventBus(),
      handleNcpEvent: vi.fn(),
      onSessionUpdated,
    });
    manager.start();

    const handle = await ingress.handle<NcpAgentSendEnvelope, NcpRunHandle>({
      type: ingressKeys.agentRun.send,
      payload: {
        metadata: {
          label: "Draft run",
          preferred_model: "openai/gpt-5",
          session_type: "native",
        },
        message: {
          id: "user-message-1",
          role: "user",
          status: "final",
          timestamp: "2026-05-20T00:00:00.000Z",
          parts: [{ type: "text", text: "hello" }],
        },
      },
    }, { source: "test" });

    expect(runtimeFactoryParams).toHaveLength(1);
    expect(runtimeInputs).toHaveLength(1);
    expect(runtimeInputs[0]?.sessionId).toMatch(/^ncp-/);
    expect(runtimeInputs[0]?.messages[0]?.sessionId).toBe(runtimeInputs[0]?.sessionId);
    expect(runtimeInputs[0]?.metadata).toMatchObject({
      label: "Draft run",
      preferred_model: "openai/gpt-5",
      session_type: "native",
    });
    expect(runtimeFactoryParams[0]?.sessionId).toBe(runtimeInputs[0]?.sessionId);
    expect(onSessionUpdated).toHaveBeenCalledWith(runtimeInputs[0]?.sessionId);
    expect(handle).toEqual({
      sessionId: runtimeInputs[0]?.sessionId,
      userMessageId: "user-message-1",
      assistantMessageId: "assistant-message-1",
      runId: "run-1",
    });
  });
});
