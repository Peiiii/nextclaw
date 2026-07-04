import { render, screen } from "@testing-library/react";
import type { NcpMessage } from "@nextclaw/ncp";
import { beforeEach, expect, it, vi } from "vitest";
import { ChatMessageListContainer } from "@/features/chat/features/message/components/chat-message-list.container";

const captures = vi.hoisted(() => ({
  renders: [] as Array<{
    messages: unknown[];
    onToolAction?: (action: unknown) => void;
    onFileOpen?: (action: unknown) => void;
    renderPanelAppCard?: (panelApp: unknown) => unknown;
    texts?: Record<string, unknown>;
  }>,
  language: "en",
  openFilePreview: vi.fn(),
  handleToolAction: vi.fn(),
}));

vi.mock("@nextclaw/agent-chat-ui", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    ChatMessageList: (props: {
      messages: unknown[];
      onToolAction?: (action: unknown) => void;
      onFileOpen?: (action: unknown) => void;
      renderPanelAppCard?: (panelApp: unknown) => unknown;
      texts?: Record<string, unknown>;
    }) => {
      captures.renders.push(props);
      return <div data-testid="chat-message-list" />;
    },
  };
});

vi.mock("@/features/chat/components/providers/chat-presenter.provider", () => ({
  usePresenter: () => ({
    chatThreadManager: {
      openFilePreview: captures.openFilePreview,
      handleToolAction: captures.handleToolAction,
    },
  }),
}));

vi.mock("@/app/components/i18n-provider", () => ({
  useI18n: () => ({ language: captures.language }),
}));

vi.mock("@/shared/lib/i18n", () => ({
  formatDateTime: (value: string) => `formatted:${value}`,
  t: (key: string) => key,
}));

beforeEach(() => {
  captures.renders = [];
  captures.language = "en";
  captures.openFilePreview.mockReset();
  captures.handleToolAction.mockReset();
});

it("reuses adapted message references when the source message object is unchanged", () => {
  const message = {
    id: "assistant-1",
    sessionId: "session-1",
    role: "assistant",
    status: "streaming",
    timestamp: "2026-03-17T10:00:00.000Z",
    parts: [{ type: "text", text: "hello" }],
  } satisfies NcpMessage;

  const { rerender } = render(
    <ChatMessageListContainer messages={[message]} isSending={false} />,
  );

  const firstMessages =
    captures.renders[captures.renders.length - 1]?.messages ?? [];

  rerender(
    <ChatMessageListContainer messages={[message]} isSending={false} />,
  );

  const secondMessages =
    captures.renders[captures.renders.length - 1]?.messages ?? [];

  expect(secondMessages[0]).toBe(firstMessages[0]);
});

it("keeps historical adapted message references stable when only the streaming message changes", () => {
  const historicalMessage = {
    id: "assistant-1",
    sessionId: "session-1",
    role: "assistant",
    status: "final",
    timestamp: "2026-03-17T10:00:00.000Z",
    parts: [{ type: "text", text: "history" }],
  } satisfies NcpMessage;
  const firstStreamingMessage = {
    id: "assistant-2",
    sessionId: "session-1",
    role: "assistant",
    status: "streaming",
    timestamp: "2026-03-17T10:00:01.000Z",
    parts: [{ type: "text", text: "hello" }],
  } satisfies NcpMessage;

  const { rerender } = render(
    <ChatMessageListContainer
      messages={[historicalMessage, firstStreamingMessage]}
      isSending={false}
    />,
  );

  const firstMessages =
    captures.renders[captures.renders.length - 1]?.messages ?? [];
  const nextStreamingMessage = {
    ...firstStreamingMessage,
    parts: [{ type: "text", text: "hello world" }],
  } satisfies NcpMessage;

  rerender(
    <ChatMessageListContainer
      messages={[historicalMessage, nextStreamingMessage]}
      isSending={false}
    />,
  );

  const secondMessages =
    captures.renders[captures.renders.length - 1]?.messages ?? [];

  expect(secondMessages[0]).toBe(firstMessages[0]);
  expect(secondMessages[1]).not.toBe(firstMessages[1]);
});

it("adapts persisted inline token metadata into markdown token data", () => {
  const message = {
    id: "user-inline-token",
    sessionId: "session-1",
    role: "user",
    status: "final",
    timestamp: "2026-03-31T10:00:00.000Z",
    metadata: {
      ui_inline_tokens: [
        {
          kind: "skill",
          key: "weather",
          label: "Weather",
          rawText: "$weather",
        },
      ],
    },
    parts: [{ type: "text", text: "please use $weather now" }],
  } satisfies NcpMessage;

  render(<ChatMessageListContainer messages={[message]} isSending={false} />);

  const renderedMessages =
    captures.renders[captures.renders.length - 1]?.messages ?? [];
  expect(renderedMessages[0]).toMatchObject({
    parts: [
      {
        type: "markdown",
        text: "please use $weather now",
        inlineTokens: [
          {
            kind: "skill",
            key: "weather",
            label: "Weather",
            rawText: "$weather",
          },
        ],
      },
    ],
  });
});

it("adds a completed assistant process summary without inventing a duration", () => {
  const userMessage = {
    id: "user-process-request",
    sessionId: "session-1",
    role: "user",
    status: "final",
    timestamp: "2026-03-31T10:00:00.000Z",
    parts: [{ type: "text", text: "please inspect the repo" }],
  } satisfies NcpMessage;
  const assistantMessage = {
    id: "assistant-process-result",
    sessionId: "session-1",
    role: "assistant",
    status: "final",
    timestamp: "2026-03-31T10:01:03.000Z",
    parts: [
      {
        type: "reasoning",
        text: "Inspecting current state.",
      },
      {
        type: "tool-invocation",
        toolCallId: "tool-1",
        toolName: "exec_command",
        state: "result",
        args: "{\"cmd\":\"git status\"}",
        result: "clean",
      },
      {
        type: "text",
        text: "Done.",
      },
    ],
  } satisfies NcpMessage;

  render(
    <ChatMessageListContainer
      messages={[userMessage, assistantMessage]}
      isSending={false}
    />,
  );

  const renderedMessages =
    captures.renders[captures.renders.length - 1]?.messages ?? [];
  expect(renderedMessages[1]).toMatchObject({
    processSummary: {
      label: "chatProcessSummaryProcessed",
    },
  });
});

it("derives completed assistant process duration from message lifecycle", () => {
  const assistantMessage = {
    id: "assistant-process-result",
    sessionId: "session-1",
    role: "assistant",
    status: "final",
    timestamp: "2026-03-31T10:01:03.000Z",
    lifecycle: {
      startedAt: "2026-03-31T10:00:00.000Z",
      endedAt: "2026-03-31T10:03:51.000Z",
    },
    parts: [
      {
        type: "reasoning",
        text: "Inspecting current state.",
      },
      {
        type: "tool-invocation",
        toolCallId: "tool-1",
        toolName: "exec_command",
        state: "result",
        args: "{\"cmd\":\"git status\"}",
        result: "clean",
      },
      {
        type: "text",
        text: "Done.",
      },
    ],
  } satisfies NcpMessage;

  render(
    <ChatMessageListContainer
      messages={[assistantMessage]}
      isSending={false}
    />,
  );

  const renderedMessages =
    captures.renders[captures.renders.length - 1]?.messages ?? [];
  expect(renderedMessages[0]).toMatchObject({
    processSummary: {
      label: "chatProcessSummaryProcessed 3m 51s",
    },
  });
});

it("wires markdown file link actions to the workspace file preview manager", () => {
  const message = {
    id: "assistant-file-link",
    sessionId: "session-1",
    role: "assistant",
    status: "final",
    timestamp: "2026-03-31T10:00:00.000Z",
    parts: [
      {
        type: "text",
        text: "[particle-cosmos.html](/Users/peiwang/Downloads/particle-cosmos.html)",
      },
    ],
  } satisfies NcpMessage;
  const action = {
    path: "/Users/peiwang/Downloads/particle-cosmos.html",
    label: "particle-cosmos.html",
    viewMode: "preview",
  };

  render(<ChatMessageListContainer messages={[message]} isSending={false} />);
  captures.renders[captures.renders.length - 1]?.onFileOpen?.(action);

  expect(captures.openFilePreview).toHaveBeenCalledWith(action);
});

it("renders context inheritance as a divider without repeating inherited messages", () => {
  const inheritedMessage = {
    id: "child-session:inherited:1",
    sessionId: "child-session",
    role: "user",
    status: "final",
    timestamp: "2026-03-31T10:00:00.000Z",
    metadata: {
      inherited_from_session_id: "parent-session",
      inherited_from_message_id: "parent-message-1",
    },
    parts: [{ type: "text", text: "parent context" }],
  } satisfies NcpMessage;
  const childMessage = {
    id: "child-message-1",
    sessionId: "child-session",
    role: "user",
    status: "final",
    timestamp: "2026-03-31T10:00:01.000Z",
    parts: [{ type: "text", text: "child visible request" }],
  } satisfies NcpMessage;

  const { container } = render(
    <ChatMessageListContainer
      messages={[inheritedMessage, childMessage]}
      isSending={false}
    />,
  );
  const renderedMessages = captures.renders.flatMap((rendered) => rendered.messages);
  const renderedPayload = JSON.stringify(renderedMessages);

  expect(screen.getByText("chatContextInheritanceInherited")).toBeTruthy();
  expect(container.querySelector('[title*="parent-session"]')).toBeTruthy();
  expect(container.querySelector('[title*="chatContextInheritanceMessages: 1"]')).toBeTruthy();
  expect(renderedPayload).toContain("child visible request");
  expect(renderedPayload).not.toContain("parent context");
});

it("keeps Hermes tool invocation parts as tool cards instead of flattening them into plain text", () => {
  const message = {
    id: "assistant-hermes-tool-1",
    sessionId: "session-1",
    role: "assistant",
    status: "final",
    timestamp: "2026-04-16T00:00:00.000Z",
    parts: [
      {
        type: "reasoning",
        text: "The user wants Python files.",
      },
      {
        type: "text",
        text: "\n",
      },
      {
        type: "tool-invocation",
        toolCallId: "hermes-inline-tool-1",
        toolName: "search_files",
        state: "call",
        args: "{\"pattern\":\"*.py\"}",
      },
      {
        type: "text",
        text: "\nFound them.",
      },
    ],
  } satisfies NcpMessage;

  render(<ChatMessageListContainer messages={[message]} isSending={false} />);

  const renderedMessages =
    captures.renders[captures.renders.length - 1]?.messages ?? [];
  expect(renderedMessages[0]).toMatchObject({
    parts: expect.arrayContaining([
      expect.objectContaining({
        type: "tool-card",
        card: expect.objectContaining({
          toolName: "search_files",
          titleLabel: "chatToolCall",
          statusTone: "running",
          statusLabel: "chatToolStatusRunning",
        }),
      }),
    ]),
  });
});

it("passes localized attachment card texts to the shared chat UI", () => {
  captures.language = "zh";

  render(<ChatMessageListContainer messages={[]} isSending={false} />);

  expect(captures.renders[captures.renders.length - 1]?.texts).toMatchObject({
    attachmentOpenLabel: "chatAttachmentOpen",
    attachmentAttachedLabel: "chatAttachmentAttached",
    attachmentCategoryLabels: {
      archive: "chatAttachmentCategoryArchive",
      pdf: "chatAttachmentCategoryPdf",
      generic: "chatAttachmentCategoryGeneric",
    },
  });
});

it("delegates tool actions to the chat thread manager owner", () => {
  const toolAction = {
    kind: "open-session",
    sessionId: "child-session-1",
    sessionKind: "child",
  };

  render(<ChatMessageListContainer messages={[]} isSending={false} />);

  captures.renders[captures.renders.length - 1]?.onToolAction?.(toolAction);

  expect(captures.handleToolAction).toHaveBeenCalledWith(toolAction);
});

it("passes the inline panel app renderer to the shared chat UI", () => {
  render(<ChatMessageListContainer messages={[]} isSending={false} />);

  expect(captures.renders[captures.renders.length - 1]?.renderPanelAppCard).toEqual(expect.any(Function));
});

it("renders context compaction as an in-flow divider instead of a chat message", () => {
  const beforeMessage = {
    id: "message-before",
    sessionId: "session-1",
    role: "user",
    status: "final",
    timestamp: "2026-05-05T11:59:00.000Z",
    parts: [{ type: "text", text: "before" }],
  } satisfies NcpMessage;
  const afterMessage = {
    id: "message-after",
    sessionId: "session-1",
    role: "assistant",
    status: "final",
    timestamp: "2026-05-05T12:01:00.000Z",
    parts: [{ type: "text", text: "after" }],
  } satisfies NcpMessage;
  const compactionMessage = {
    id: "ctx-message",
    sessionId: "session-1",
    role: "service",
    status: "final",
    timestamp: "2026-05-05T12:00:00.000Z",
    metadata: {
      nextclaw_timeline_kind: "context_compaction",
      checkpoint: {
        id: "ctx-1",
        status: "compressed",
        summary: "Compressed Earlier Context",
        coveredMessageCount: 8,
        coveredSessionMessageCount: 8,
        originalEstimatedTokens: 76000,
        projectedEstimatedTokens: 51000,
        createdAt: "2026-05-05T11:59:50.000Z",
        updatedAt: "2026-05-05T12:00:00.000Z",
      },
    },
    parts: [{ type: "text", text: "较早上下文已自动压缩" }],
  } satisfies NcpMessage;

  const { getByText } = render(
    <ChatMessageListContainer
      messages={[beforeMessage, compactionMessage, afterMessage]}
      isSending={false}
    />,
  );

  expect(getByText("chatContextCompactionCompressed")).toBeTruthy();
  const renderedGroups = captures.renders.map((rendered) => rendered.messages);
  expect(renderedGroups).toHaveLength(2);
  expect(renderedGroups[0]).toMatchObject([{ id: "message-before" }]);
  expect(renderedGroups[1]).toMatchObject([{ id: "message-after" }]);
});
