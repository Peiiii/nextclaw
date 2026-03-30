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
import { createUiNcpAgent } from "./create-ui-ncp-agent.js";

const tempDirs: string[] = [];

function createTempWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-ncp-subagent-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("createUiNcpAgent subagent completion", () => {
  it("persists NCP-native subagent completion back into the originating session without the legacy relay", async () => {
    const workspace = createTempWorkspace();
    const sessionId = "session-subagent-native";
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

    await ncpAgent.agentClientEndpoint.send(
      createEnvelope({
        sessionId,
        text: "spawn a subagent to verify 1+1=2",
      }),
    );

    await vi.waitFor(async () => {
      const messages = await ncpAgent.sessionApi.listSessionMessages(sessionId);
      expect(
        messages.some(
          (message) =>
            message.role === "service" &&
            message.parts.some(
              (part) =>
                part.type === "text" &&
                part.text.includes("Subagent") &&
                part.text.includes("Verified 1+1=2"),
            ),
        ),
      ).toBe(true);
    });

    const refreshedMessages = await ncpAgent.sessionApi.listSessionMessages(sessionId);
    expect(
      refreshedMessages.some(
        (message) =>
          message.role === "service" &&
          message.parts.some(
            (part) =>
              part.type === "extension" &&
              part.extensionType === "nextclaw.subagent.completion",
          ),
      ),
    ).toBe(true);

    const persistedSession = sessionManager.getIfExists(sessionId);
    expect(
      persistedSession?.messages.some(
        (message) =>
          message.role === "service" &&
          String(message.content ?? "").includes("Verified 1+1=2"),
      ),
    ).toBe(true);
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
    const hasSpawnToolResult = params.messages.some(
      (message) =>
        message.role === "tool" &&
        String(message.content ?? "").includes("Subagent [Verifier] started"),
    );

    return (async function* (): AsyncGenerator<LLMStreamEvent> {
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
