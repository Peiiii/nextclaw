import { describe, expect, it } from "vitest";
import {
  type NcpAgentConversationStateManager,
  type NcpEndpointEvent,
  type NcpLLMApi,
  type NcpLLMApiInput,
  type NcpLLMApiOptions,
  type NcpRequestEnvelope,
  type OpenAIChatChunk,
  NcpEventType,
} from "@nextclaw/ncp";
import {
  DefaultNcpAgentRuntime,
  DefaultNcpContextBuilder,
  DefaultNcpToolRegistry,
} from "@nextclaw/ncp-agent-runtime";
import { DefaultNcpAgentBackend } from "../agent-backend/index.js";
import { DefaultNcpAgentConversationStateManager } from "../agent-conversation-state-manager.js";
import type {
  AgentSessionEventRecord,
  AgentSessionRecord,
  AgentSessionStore,
} from "../agent-backend/agent-backend.types.js";

const now = "2026-05-14T00:00:00.000Z";

const createEnvelope = (text: string): NcpRequestEnvelope => ({
  sessionId: "session-1",
  correlationId: "corr-1",
  message: {
    id: "user-1",
    sessionId: "session-1",
    role: "user",
    status: "final",
    parts: [{ type: "text", text }],
    timestamp: now,
  },
});

describe("DefaultNcpAgentBackend append-only session persistence", () => {
  it("does not call full saveSession for every runtime event when appendSessionEvent is available", async () => {
    const sessionStore = new JournalRecordingSessionStore();
    const backend = new DefaultNcpAgentBackend({
      sessionStore,
      createRuntime: ({
        stateManager,
      }: {
        stateManager: NcpAgentConversationStateManager;
      }) => {
        const toolRegistry = new DefaultNcpToolRegistry();
        return new DefaultNcpAgentRuntime({
          contextBuilder: new DefaultNcpContextBuilder(toolRegistry),
          llmApi: new SlowEchoNcpLLMApi(),
          toolRegistry,
          stateManager,
        });
      },
    });

    await backend.emit({
      type: NcpEventType.MessageRequest,
      payload: createEnvelope("journal"),
    });

    expect(sessionStore.saveCallCount).toBe(0);
    expect(sessionStore.appendEventCount).toBeGreaterThan(0);
    expect(sessionStore.eventTypes).toContain(NcpEventType.MessageTextDelta);
    const messages = await backend.listSessionMessages("session-1");
    expect(messages.at(-1)).toMatchObject({
      role: "assistant",
      parts: [{ type: "text", text: "journal" }],
    });
  });
});

class SlowEchoNcpLLMApi implements NcpLLMApi {
  generate = (
    input: NcpLLMApiInput,
    options?: NcpLLMApiOptions,
  ): AsyncGenerator<OpenAIChatChunk> => (async function* (): AsyncGenerator<OpenAIChatChunk> {
    const text = readLastUserText(input);
    for (const char of text) {
      if (options?.signal?.aborted) {
        break;
      }
      yield {
        choices: [{ index: 0, delta: { content: char } }],
      };
    }
    yield {
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
    };
  })();
}

class JournalRecordingSessionStore implements AgentSessionStore {
  private readonly sessions = new Map<string, AgentSessionRecord>();
  private readonly stateManagers =
    new Map<string, DefaultNcpAgentConversationStateManager>();

  appendEventCount = 0;
  saveCallCount = 0;
  readonly eventTypes: string[] = [];

  getSession = async (
    sessionId: string,
  ): Promise<AgentSessionRecord | null> => {
    const session = this.sessions.get(sessionId);
    return session ? structuredClone(session) : null;
  };

  listSessions = async (): Promise<AgentSessionRecord[]> => {
    return [...this.sessions.values()].map((session) =>
      structuredClone(session),
    );
  };

  listSessionMessages = async (sessionId: string) => {
    return (await this.getSession(sessionId))?.messages ?? [];
  };

  appendSessionEvent = async (params: {
    session: AgentSessionEventRecord;
    event: NcpEndpointEvent;
    updatedAt: string;
  }): Promise<void> => {
    const { event, session } = params;
    this.appendEventCount += 1;
    this.eventTypes.push(event.type);
    expect("messages" in session).toBe(false);
    const stateManager =
      this.stateManagers.get(session.sessionId) ??
      new DefaultNcpAgentConversationStateManager();
    this.stateManagers.set(session.sessionId, stateManager);
    await stateManager.dispatch(
      event.type === NcpEventType.MessageCompleted
        ? {
            type: NcpEventType.MessageSent,
            payload: {
              sessionId: event.payload.sessionId,
              message: event.payload.message,
              ...(event.payload.correlationId ? { correlationId: event.payload.correlationId } : {}),
              metadata: event.payload.metadata,
            },
          }
        : structuredClone(event),
    );
    const snapshot = stateManager.getSnapshot();
    this.sessions.set(session.sessionId, {
      ...structuredClone(session),
      messages: [
        ...snapshot.messages.map((message) => structuredClone(message)),
        ...(snapshot.streamingMessage ? [structuredClone(snapshot.streamingMessage)] : []),
      ],
    });
  };

  saveSession = async (session: AgentSessionRecord): Promise<void> => {
    this.saveCallCount += 1;
    this.sessions.set(session.sessionId, structuredClone(session));
  };

  replaceSession = async (session: AgentSessionRecord): Promise<void> => {
    this.sessions.set(session.sessionId, structuredClone(session));
  };

  deleteSession = async (
    sessionId: string,
  ): Promise<AgentSessionRecord | null> => {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    this.sessions.delete(sessionId);
    return structuredClone(session);
  };
}

function readLastUserText(input: NcpLLMApiInput): string {
  for (let index = input.messages.length - 1; index >= 0; index -= 1) {
    const message = input.messages[index];
    if (message?.role === "user" && typeof message.content === "string") {
      return message.content;
    }
  }
  return "";
}
