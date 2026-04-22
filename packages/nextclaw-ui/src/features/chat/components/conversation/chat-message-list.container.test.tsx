import { render } from "@testing-library/react";
import type { NcpMessage } from "@nextclaw/ncp";
import { beforeEach, expect, it, vi } from "vitest";
import { ChatMessageListContainer } from "./chat-message-list.container";

const captures = vi.hoisted(() => ({
  renders: [] as Array<{ messages: unknown[]; texts?: Record<string, unknown> }>,
  language: "en",
}));

vi.mock("@nextclaw/agent-chat-ui", () => ({
  ChatMessageList: (props: { messages: unknown[]; texts?: Record<string, unknown> }) => {
    captures.renders.push(props);
    return <div data-testid="chat-message-list" />;
  },
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

it("adapts persisted inline token metadata into rich message parts", () => {
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
        type: "inline-content",
        segments: [
          { type: "markdown", text: "please use " },
          {
            type: "token",
            token: {
              kind: "skill",
              key: "weather",
              label: "Weather",
            },
          },
          { type: "markdown", text: " now" },
        ],
      },
    ],
  });
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
