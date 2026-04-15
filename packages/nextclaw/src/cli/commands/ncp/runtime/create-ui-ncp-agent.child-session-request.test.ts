import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  ConfigSchema,
  MessageBus,
  SessionManager,
  type LLMStreamEvent,
  type ProviderManager,
} from "@nextclaw/core";
import {
  NcpEventType,
  type NcpEndpointEvent,
  type NcpRequestEnvelope,
} from "@nextclaw/ncp";
import {
  createUiNcpAgent,
  type UiNcpAgentHandle,
} from "../create-ui-ncp-agent.service.js";

const tempDirs: string[] = [];
const activeAgents: UiNcpAgentHandle[] = [];
const originalNextclawHome = process.env.NEXTCLAW_HOME;

function createTempWorkspace(): { workspace: string; home: string } {
  const workspace = mkdtempSync(join(tmpdir(), "nextclaw-ncp-child-request-"));
  tempDirs.push(workspace);
  const home = join(workspace, "home");
  mkdirSync(home, { recursive: true });
  process.env.NEXTCLAW_HOME = home;
  return { workspace, home };
}

function createEnvelope(params: {
  sessionId: string;
  text: string;
}): NcpRequestEnvelope {
  const { sessionId, text } = params;
  return {
    sessionId,
    message: {
      id: `${sessionId}:user:${Date.now()}`,
      sessionId,
      role: "user",
      status: "final",
      timestamp: new Date().toISOString(),
      parts: [{ type: "text", text }],
    },
  };
}

async function sendAndCollectEvents(
  endpoint: {
    send(envelope: NcpRequestEnvelope): Promise<void>;
    subscribe(listener: (event: NcpEndpointEvent) => void): () => void;
  },
  envelope: NcpRequestEnvelope,
): Promise<NcpEndpointEvent[]> {
  const events: NcpEndpointEvent[] = [];
  const unsubscribe = endpoint.subscribe((event) => {
    if (!("payload" in event)) {
      return;
    }
    const payload = event.payload;
    if (payload && "sessionId" in payload && payload.sessionId !== envelope.sessionId) {
      return;
    }
    events.push(event);
  });
  try {
    await endpoint.send(envelope);
    return events;
  } finally {
    unsubscribe();
  }
}

function readLastUserText(messages: Array<Record<string, unknown>>): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "user") {
      continue;
    }
    const content = typeof message.content === "string" ? message.content : "";
    if (content.trim()) {
      return content.trim();
    }
  }
  return "";
}

function readLatestSessionRequestResult(messages: Array<Record<string, unknown>>): {
  sessionId: string;
  task: string;
} | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "tool" || typeof message.content !== "string") {
      continue;
    }
    try {
      const parsed = JSON.parse(message.content) as {
        kind?: string;
        sessionId?: string;
        task?: string;
      };
      if (
        parsed.kind === "nextclaw.session_request" &&
        typeof parsed.sessionId === "string" &&
        parsed.sessionId.trim() &&
        typeof parsed.task === "string" &&
        parsed.task.trim()
      ) {
        return {
          sessionId: parsed.sessionId.trim(),
          task: parsed.task.trim(),
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

class ChildSessionFollowupProviderManager {
  get = () => ({
    getDefaultModel: () => "default-model",
  });

  chatStream = (params: {
    messages: Array<Record<string, unknown>>;
  }): AsyncGenerator<LLMStreamEvent> => {
    const lastUserText = readLastUserText(params.messages);
    const latestRequestResult = readLatestSessionRequestResult(params.messages);

    return (async function* (): AsyncGenerator<LLMStreamEvent> {
      if (lastUserText.includes("Initial child task")) {
        yield {
          type: "done",
          response: {
            content: "Initial child task completed.",
            toolCalls: [],
            finishReason: "stop",
            usage: {},
          },
        };
        return;
      }

      if (lastUserText.includes("Follow-up child task")) {
        yield {
          type: "done",
          response: {
            content: "Follow-up child task completed.",
            toolCalls: [],
            finishReason: "stop",
            usage: {},
          },
        };
        return;
      }

      if (!latestRequestResult) {
        yield {
          type: "done",
          response: {
            content: "",
            toolCalls: [
              {
                id: "spawn-call-1",
                name: "sessions_spawn",
                arguments: {
                  scope: "child",
                  title: "Child worker",
                  task: "Initial child task",
                  request: {
                    notify: "final_reply",
                  },
                },
              },
            ],
            finishReason: "tool_calls",
            usage: {},
          },
        };
        return;
      }

      if (latestRequestResult.task === "Initial child task") {
        yield {
          type: "done",
          response: {
            content: "",
            toolCalls: [
              {
                id: "request-call-1",
                name: "sessions_request",
                arguments: {
                  target: {
                    session_id: latestRequestResult.sessionId,
                  },
                  task: "Follow-up child task",
                  notify: "none",
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
          content: "Parent session completed after the child follow-up.",
          toolCalls: [],
          finishReason: "stop",
          usage: {},
        },
      };
    })();
  };
}

afterEach(async () => {
  while (activeAgents.length > 0) {
    const agent = activeAgents.pop();
    await agent?.dispose?.();
  }
  if (originalNextclawHome) {
    process.env.NEXTCLAW_HOME = originalNextclawHome;
  } else {
    delete process.env.NEXTCLAW_HOME;
  }
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("createUiNcpAgent child session follow-up requests", () => {
  it("allows sessions_request to target a spawned child session in the same backend", async () => {
    const { workspace } = createTempWorkspace();
    const sessionManager = new SessionManager(workspace);
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
      bus: new MessageBus(),
      providerManager: new ChildSessionFollowupProviderManager() as unknown as ProviderManager,
      sessionManager,
      getConfig: () => config,
    });
    activeAgents.push(ncpAgent);

    const events = await sendAndCollectEvents(
      ncpAgent.agentClientEndpoint,
      createEnvelope({
        sessionId: "parent-session-1",
        text: "Start the child flow and then follow up on that child.",
      }),
    );

    expect(events.some((event) => event.type === NcpEventType.MessageFailed)).toBe(false);
    expect(events.some((event) => event.type === NcpEventType.MessageCompleted)).toBe(true);
    expect(events.at(-1)?.type).toBe(NcpEventType.RunFinished);

    const messages = await ncpAgent.sessionApi.listSessionMessages("parent-session-1");
    expect(
      messages.some(
        (message) =>
          message.role === "assistant" &&
          message.parts.some(
            (part) =>
              part.type === "text" &&
              part.text.includes("Parent session completed after the child follow-up."),
          ),
      ),
    ).toBe(true);
  });

  it("still allows sessions_request to target the spawned child session after backend recreation", async () => {
    const { workspace } = createTempWorkspace();
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
    const sessionId = "parent-session-2";

    const firstAgent = await createUiNcpAgent({
      bus: new MessageBus(),
      providerManager: new ChildSessionFollowupProviderManager() as unknown as ProviderManager,
      sessionManager: new SessionManager(workspace),
      getConfig: () => config,
    });
    activeAgents.push(firstAgent);

    const firstEvents = await sendAndCollectEvents(
      firstAgent.agentClientEndpoint,
      createEnvelope({
        sessionId,
        text: "Create the child session only.",
      }),
    );

    expect(firstEvents.some((event) => event.type === NcpEventType.MessageFailed)).toBe(false);
    await firstAgent.dispose?.();
    activeAgents.pop();

    const secondAgent = await createUiNcpAgent({
      bus: new MessageBus(),
      providerManager: new ChildSessionFollowupProviderManager() as unknown as ProviderManager,
      sessionManager: new SessionManager(workspace),
      getConfig: () => config,
    });
    activeAgents.push(secondAgent);

    const secondEvents = await sendAndCollectEvents(
      secondAgent.agentClientEndpoint,
      createEnvelope({
        sessionId,
        text: "Follow up on the previously spawned child session.",
      }),
    );

    expect(secondEvents.some((event) => event.type === NcpEventType.MessageFailed)).toBe(false);
    expect(secondEvents.some((event) => event.type === NcpEventType.MessageCompleted)).toBe(true);
    expect(secondEvents.at(-1)?.type).toBe(NcpEventType.RunFinished);
  });

  it("keeps child sessions requestable when ambient NEXTCLAW_HOME changes but the runtime reuses the same explicit home", async () => {
    const { workspace, home } = createTempWorkspace();
    const otherHomeRoot = mkdtempSync(join(tmpdir(), "nextclaw-ncp-child-request-other-home-"));
    tempDirs.push(otherHomeRoot);
    const otherHome = join(otherHomeRoot, "home");
    mkdirSync(otherHome, { recursive: true });
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
    const sessionId = "parent-session-3";

    const firstAgent = await createUiNcpAgent({
      bus: new MessageBus(),
      providerManager: new ChildSessionFollowupProviderManager() as unknown as ProviderManager,
      sessionManager: new SessionManager({ workspace, homeDir: home }),
      getConfig: () => config,
    });
    activeAgents.push(firstAgent);

    const firstEvents = await sendAndCollectEvents(
      firstAgent.agentClientEndpoint,
      createEnvelope({
        sessionId,
        text: "Create the child session only.",
      }),
    );

    expect(firstEvents.some((event) => event.type === NcpEventType.MessageFailed)).toBe(false);
    await firstAgent.dispose?.();
    activeAgents.pop();

    process.env.NEXTCLAW_HOME = otherHome;
    const secondAgent = await createUiNcpAgent({
      bus: new MessageBus(),
      providerManager: new ChildSessionFollowupProviderManager() as unknown as ProviderManager,
      sessionManager: new SessionManager({ workspace, homeDir: home }),
      getConfig: () => config,
    });
    activeAgents.push(secondAgent);

    const secondEvents = await sendAndCollectEvents(
      secondAgent.agentClientEndpoint,
      createEnvelope({
        sessionId,
        text: "Follow up on the previously spawned child session.",
      }),
    );

    expect(secondEvents.some((event) => event.type === NcpEventType.MessageFailed)).toBe(false);
    expect(secondEvents.some((event) => event.type === NcpEventType.MessageCompleted)).toBe(true);
    expect(secondEvents.at(-1)?.type).toBe(NcpEventType.RunFinished);
  });
});
