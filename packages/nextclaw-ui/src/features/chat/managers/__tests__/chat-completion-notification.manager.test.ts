import {
  NCP_INTERNAL_VISIBILITY_METADATA_KEY,
  NcpEventType,
  type NcpEndpointEvent,
  type NcpMessage,
} from "@nextclaw/ncp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatCompletionNotificationManager } from "@/features/chat/managers/chat-completion-notification.manager";
import { buildSessionPath } from "@/features/chat/features/session/utils/chat-session-route.utils";
import { useChatQueryStore } from "@/features/chat/stores/ncp-chat-query.store";

const mocks = vi.hoisted(() => ({
  eventHandler: null as ((event: NcpEndpointEvent) => void) | null,
  on: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("@/shared/lib/api", () => ({
  nextclawClient: {
    eventBus: {
      on: mocks.on,
    },
  },
}));

function createMessage(overrides: Partial<NcpMessage> = {}): NcpMessage {
  return {
    id: "assistant-message-1",
    sessionId: "session-background",
    role: "assistant",
    status: "final",
    timestamp: "2026-08-05T10:00:00.000Z",
    parts: [{ type: "text", text: "  The requested research is complete.  " }],
    ...overrides,
  };
}

function createCompletedEvent(message = createMessage()): NcpEndpointEvent {
  return {
    type: NcpEventType.MessageCompleted,
    payload: {
      sessionId: message.sessionId,
      message,
    },
  };
}

function emit(event: NcpEndpointEvent): void {
  if (!mocks.eventHandler) {
    throw new Error("Notification manager has not subscribed");
  }
  mocks.eventHandler(event);
}

describe("ChatCompletionNotificationManager", () => {
  const show = vi.fn();
  let manager: ChatCompletionNotificationManager;

  beforeEach(() => {
    mocks.eventHandler = null;
    mocks.on.mockReset();
    mocks.unsubscribe.mockReset();
    mocks.on.mockImplementation((_key, handler: (event: NcpEndpointEvent) => void) => {
      mocks.eventHandler = handler;
      return mocks.unsubscribe;
    });
    show.mockReset();
    useChatQueryStore.setState({ snapshot: {} });
    manager = new ChatCompletionNotificationManager({ show });
  });

  afterEach(() => {
    manager.stop();
  });

  it("maps a background assistant final reply to a navigable global notification", () => {
    useChatQueryStore.setState({
      snapshot: {
        sessionsQuery: {
          data: {
            sessions: [{
              sessionId: "session-background",
              messageCount: 2,
              updatedAt: "2026-08-05T10:00:00.000Z",
              metadata: { label: "Quarterly research" },
            }],
            total: 1,
          },
        } as never,
      },
    });
    manager.start();
    emit(createCompletedEvent());

    expect(show).toHaveBeenCalledWith({
      id: "chat-reply:assistant-message-1",
      title: "Quarterly research",
      description: "The requested research is complete.",
      href: buildSessionPath("session-background"),
      ariaLabel: "Open the new reply in Quarterly research",
    });
  });

  it("suppresses messages completed in any visible session, including later replays", () => {
    manager.start();
    manager.syncVisibleSessions(["session-main", "session-background"]);
    emit(createCompletedEvent());
    expect(show).not.toHaveBeenCalled();

    manager.syncVisibleSessions(["session-main"]);
    emit(createCompletedEvent());
    expect(show).not.toHaveBeenCalled();

    const nextMessage = createMessage({ id: "assistant-message-2" });
    emit(createCompletedEvent(nextMessage));
    emit(createCompletedEvent(nextMessage));
    expect(show).toHaveBeenCalledOnce();
  });

  it("ignores non-final, non-assistant, hidden, and unrelated events", () => {
    manager.start();
    emit(createCompletedEvent(createMessage({ status: "streaming" })));
    emit(createCompletedEvent(createMessage({ role: "service" })));
    emit(createCompletedEvent(createMessage({
      metadata: { [NCP_INTERNAL_VISIBILITY_METADATA_KEY]: "hidden" },
    })));
    emit({
      type: NcpEventType.RunFinished,
      payload: { sessionId: "session-background" },
    });

    expect(show).not.toHaveBeenCalled();
  });

  it("uses localized fallbacks when the session and reply have no display text", () => {
    manager.start();
    emit(createCompletedEvent(createMessage({ parts: [] })));

    expect(show).toHaveBeenCalledWith(expect.objectContaining({
      title: "New reply",
      description: "A reply is ready. Open the session to view it.",
    }));
  });

  it("projects markdown replies into a readable plain-text preview", () => {
    manager.start();
    emit(createCompletedEvent(createMessage({
      parts: [{
        type: "text",
        text: [
          "# Release **complete**",
          "",
          "- [x] Open the [report](https://example.com/report)",
          "> Review `details` and ~~obsolete notes~~",
          "",
          "```sh",
          "pnpm test",
          "```",
        ].join("\n"),
      }],
    })));

    expect(show).toHaveBeenCalledWith(expect.objectContaining({
      description: "Release complete Open the report Review details and obsolete notes pnpm test",
    }));
  });

  it("owns an idempotent realtime subscription lifecycle", () => {
    manager.start();
    manager.start();
    expect(mocks.on).toHaveBeenCalledOnce();

    manager.stop();
    manager.stop();
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  });
});
