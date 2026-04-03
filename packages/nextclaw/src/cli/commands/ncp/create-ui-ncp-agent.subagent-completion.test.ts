import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ConfigSchema,
  type LLMStreamEvent,
  type MessageBus,
  type ProviderManager,
  SessionManager,
} from "@nextclaw/core";
import { type NcpRequestEnvelope } from "@nextclaw/ncp";
import {
  createUiNcpAgent,
  type UiNcpAgentHandle,
} from "./create-ui-ncp-agent.js";

const tempDirs: string[] = [];
const activeAgents: UiNcpAgentHandle[] = [];

function createTempWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-ncp-session-request-"));
  tempDirs.push(dir);
  return dir;
}

async function waitForCondition(
  check: () => Promise<boolean>,
  options: {
    timeoutMs?: number;
    intervalMs?: number;
  } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 3_000;
  const intervalMs = options.intervalMs ?? 50;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    if (await check()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  expect(await check()).toBe(true);
}

afterEach(async () => {
  while (activeAgents.length > 0) {
    const agent = activeAgents.pop();
    await agent?.dispose?.();
  }
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("createUiNcpAgent session request completion", () => {
  it("persists child-session completion back into the originating session and resumes the parent run", async () => {
    const workspace = createTempWorkspace();
    const sessionId = `session-subagent-native-${Date.now().toString(36)}`;
    const sessionManager = new SessionManager(workspace);
    const publishInbound = vi.fn(async () => undefined);
    const bus = {
      publishInbound,
      publishOutbound: vi.fn(async () => undefined),
    } as unknown as MessageBus;
    const providerManager = new SubagentCompletionProviderManager();
    const config = ConfigSchema.parse({
      agents: {
        defaults: {
          workspace,
          model: "default-model",
          contextTokens: 200000,
          maxToolIterations: 8,
        },
      },
    });

    const ncpAgent = await createUiNcpAgent({
      bus,
      providerManager: providerManager as unknown as ProviderManager,
      sessionManager,
      getConfig: () => config,
    });
    activeAgents.push(ncpAgent);
    await ncpAgent.agentClientEndpoint.send(
      createEnvelope({
        sessionId,
        text: "spawn a subagent to verify 1+1=2",
      }),
    );

    await waitForCondition(async () => {
      const messages = await ncpAgent.sessionApi.listSessionMessages(sessionId);
      return messages.some(
        (message) =>
          message.role === "assistant" &&
          message.parts.some(
            (part) =>
              part.type === "tool-invocation" &&
              part.toolCallId === "spawn-call-1" &&
              part.state === "result" &&
              typeof part.result === "object" &&
              part.result !== null &&
              "kind" in part.result &&
              part.result.kind === "nextclaw.session_request" &&
              "status" in part.result &&
              part.result.status === "completed",
          ),
      );
    });

    await waitForCondition(async () => {
      const messages = await ncpAgent.sessionApi.listSessionMessages(sessionId);
      return messages.some(
        (message) =>
          message.role === "assistant" &&
          message.parts.some(
            (part) =>
              part.type === "text" &&
              part.text.includes("Verified 1+1=2") &&
              part.text.includes("continuing"),
          ),
      );
    });

      const refreshedMessages = await ncpAgent.sessionApi.listSessionMessages(sessionId);
      const childSessionResult = refreshedMessages
        .flatMap((message) => message.parts)
        .find((part) => {
          if (part.type !== "tool-invocation") {
            return false;
          }
          if (part.toolCallId !== "spawn-call-1" || part.state !== "result") {
            return false;
          }
          if (typeof part.result !== "object" || part.result === null) {
            return false;
          }
          if (!("kind" in part.result) || part.result.kind !== "nextclaw.session_request") {
            return false;
          }
          return "sessionId" in part.result && typeof part.result.sessionId === "string";
        });
      const childSessionId =
        childSessionResult?.type === "tool-invocation" &&
        typeof childSessionResult.result === "object" &&
        childSessionResult.result !== null &&
        "sessionId" in childSessionResult.result &&
        typeof childSessionResult.result.sessionId === "string"
          ? childSessionResult.result.sessionId
          : undefined;
      expect(
        refreshedMessages.some(
          (message) =>
            message.role === "assistant" &&
            message.parts.some(
              (part) =>
                part.type === "tool-invocation" &&
                part.toolCallId === "spawn-call-1" &&
                part.state === "result",
            ),
        ),
      ).toBe(true);
      expect(
        refreshedMessages.some((message) => message.role === "service"),
      ).toBe(false);
      expect(
        refreshedMessages.some(
          (message) =>
            message.role === "user" &&
            message.metadata?.system_event_kind === "session_request_completion",
        ),
      ).toBe(false);

      const persistedSession = sessionManager.getIfExists(sessionId);
      expect(
        persistedSession?.messages.some(
          (message) =>
            message.role === "assistant" &&
            Array.isArray(message.tool_calls) &&
            message.tool_calls.some((toolCall) => toolCall.id === "spawn-call-1"),
        ),
      ).toBe(true);
      expect(
        persistedSession?.messages.some(
          (message) =>
            message.role === "assistant" &&
            String(message.content ?? "").includes("continuing with the verified result"),
        ),
      ).toBe(true);
      expect(childSessionId).toBeTruthy();
      const childSession = childSessionId
        ? sessionManager.getIfExists(childSessionId)
        : null;
      expect(childSession).toBeTruthy();
      expect(childSession?.metadata?.parent_session_id).toBe(sessionId);
      expect(childSession?.metadata?.spawned_by_request_id).toBeTruthy();
      expect(publishInbound).not.toHaveBeenCalled();
  });
});

class SubagentCompletionProviderManager {
  get = () => ({
    getDefaultModel: () => "default-model",
  });

  chatStream = (params: {
    messages: Array<Record<string, unknown>>;
  }): AsyncGenerator<LLMStreamEvent> => {
    const hasDelegatedVerificationTask = params.messages.some(
      (message) =>
        message.role === "user" &&
        String(message.content ?? "").includes("Verify that 1+1=2"),
    );
    const hasSpawnToolResult = params.messages.some(
      (message) =>
        message.role === "tool" &&
        String(message.content ?? "").includes('"kind":"nextclaw.session_request"'),
    );
    const hasHiddenFollowUp = params.messages.some(
      (message) =>
        message.role === "user" &&
        String(message.content ?? "").includes("<session-request-completion>") &&
        String(message.content ?? "").includes("<status>completed</status>") &&
        String(message.content ?? "").includes("Verified 1+1=2"),
    );
    const isChildSessionRun = params.messages.some(
      (message) =>
        message.role === "user" &&
        String(message.content ?? "").includes("Verify that 1+1=2"),
    );

    return (async function* (): AsyncGenerator<LLMStreamEvent> {
      if (hasDelegatedVerificationTask) {
        yield {
          type: "done",
          response: {
            content: "Verified 1+1=2.",
            toolCalls: [],
            finishReason: "stop",
            usage: {},
          },
        };
        return;
      }

      if (hasHiddenFollowUp) {
        yield {
          type: "done",
          response: {
            content: "Verified 1+1=2 and continuing with the verified result.",
            toolCalls: [],
            finishReason: "stop",
            usage: {},
          },
        };
        return;
      }

      if (isChildSessionRun) {
        yield {
          type: "done",
          response: {
            content: "Verified 1+1=2.",
            toolCalls: [],
            finishReason: "stop",
            usage: {},
          },
        };
        return;
      }

      if (!hasSpawnToolResult) {
        yield {
          type: "done",
          response: {
            content: "",
            toolCalls: [
              {
                id: "spawn-call-1",
                name: "spawn",
                arguments: {
                  label: "Verifier",
                  task: "Verify that 1+1=2",
                },
              },
            ],
            finishReason: "tool_calls",
            usage: {},
          },
        };
        return;
      }

      yield {
        type: "done",
        response: {
          content: "Main run finished after delegating the verification.",
          toolCalls: [],
          finishReason: "stop",
          usage: {},
        },
      };
    })();
  };

  chat = async (): Promise<{ content: string; toolCalls: [] }> => ({
    content: "Verified 1+1=2.",
    toolCalls: [],
  });
}

function createEnvelope(params: { sessionId: string; text: string }): NcpRequestEnvelope {
  return {
    sessionId: params.sessionId,
    message: {
      id: `${params.sessionId}:user:${Date.now()}`,
      sessionId: params.sessionId,
      role: "user",
      status: "final",
      timestamp: new Date().toISOString(),
      parts: [{ type: "text", text: params.text }],
    },
  };
}
