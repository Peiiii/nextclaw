import { fireEvent, render, screen } from "@testing-library/react";
import { isValidElement, type ComponentProps, useRef } from "react";
import type { NcpMessage } from "@nextclaw/ncp";
import { beforeEach, expect, it, vi } from "vitest";
import { ChatMessageListContainer as RuntimeChatMessageListContainer } from "@/features/chat/features/message/components/chat-message-list.container";
import { useChatQueryStore } from "@/features/chat/stores/ncp-chat-query.store";

function ChatMessageListContainer({
  sessionKey = "session-1",
  ...props
}: Omit<
  ComponentProps<typeof RuntimeChatMessageListContainer>,
  "sessionKey" | "scrollRef"
> & {
  sessionKey?: string | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <RuntimeChatMessageListContainer
      {...props}
      scrollRef={scrollRef}
      sessionKey={sessionKey}
    />
  );
}

const captures = vi.hoisted(() => ({
  renders: [] as Array<{
    messages: unknown[];
    onToolAction?: (action: unknown) => void;
    onFileOpen?: (action: unknown) => void;
    onAttachmentOpen?: (file: unknown) => void;
    onInlineTokenClick?: (token: unknown) => void;
    assistantAvatarIcon?: unknown;
    renderInlineDisplay?: (display: unknown) => unknown;
    renderPanelAppCard?: (panelApp: unknown) => unknown;
    texts?: Record<string, unknown>;
  }>,
  language: "en",
  openFilePreview: vi.fn(),
  handleToolAction: vi.fn(),
  showContent: vi.fn(),
  filePreviewProps: [] as Array<{ showBreadcrumbs?: boolean }>,
  selectedSessionKeys: [] as Array<string | null>,
  selectedSession: null as null | {
    projectRoot: string;
    workingDir?: string | null;
    sessionType?: string;
  },
}));

vi.mock("@nextclaw/agent-chat-ui", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    ChatMessageList: (props: {
      messages: unknown[];
      onToolAction?: (action: unknown) => void;
      onFileOpen?: (action: unknown) => void;
      onAttachmentOpen?: (file: unknown) => void;
      onInlineTokenClick?: (token: unknown) => void;
      assistantAvatarIcon?: unknown;
      renderInlineDisplay?: (display: unknown) => unknown;
      renderPanelAppCard?: (panelApp: unknown) => unknown;
      texts?: Record<string, unknown>;
    }) => {
      captures.renders.push(props);
      return <div data-testid="chat-message-list" />;
    },
  };
});

vi.mock(
  "@/features/chat/features/message/hooks/use-chat-message-virtualizer",
  () => ({
    useChatMessageVirtualizer: ({
      rows,
    }: {
      rows: Array<{ key: string }>;
    }) => ({
      containerRef: vi.fn(),
      virtualizer: {
        getVirtualItems: () =>
          rows.map((_, index) => ({ index, start: index * 180 })),
        measureElement: vi.fn(),
      },
    }),
  }),
);

vi.mock("@/features/chat/components/providers/chat-presenter.provider", () => ({
  usePresenter: () => ({
    chatThreadManager: {
      openFilePreview: captures.openFilePreview,
      handleToolAction: captures.handleToolAction,
    },
    chatUiManager: {
      showContent: captures.showContent,
    },
  }),
}));

vi.mock(
  "@/features/chat/features/ncp/hooks/use-ncp-chat-derived-state",
  () => ({
  useNcpChatSelectedSession: (sessionKey: string | null) => {
    captures.selectedSessionKeys.push(sessionKey);
    return captures.selectedSession;
  },
  }),
);

vi.mock("@/app/components/i18n-provider", () => ({
  useI18n: () => ({ language: captures.language }),
}));

vi.mock("@/shared/lib/i18n", () => ({
  formatDateTime: (value: string) => `formatted:${value}`,
  t: (key: string) => key,
}));

vi.mock(
  "@/features/chat/features/workspace/components/chat-session-workspace-file-preview",
  () => ({
    ChatSessionWorkspaceFilePreview: (props: { showBreadcrumbs?: boolean }) => {
      captures.filePreviewProps.push(props);
      return <div data-testid="inline-workspace-file-preview" />;
    },
  }),
);

beforeEach(() => {
  captures.renders = [];
  captures.language = "en";
  captures.openFilePreview.mockReset();
  captures.handleToolAction.mockReset();
  captures.showContent.mockReset();
  captures.filePreviewProps = [];
  captures.selectedSessionKeys = [];
  captures.selectedSession = null;
  useChatQueryStore.setState({ snapshot: {} });
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

  const firstMessages = captures.renders.flatMap(
    (rendered) => rendered.messages,
  );

  rerender(<ChatMessageListContainer messages={[message]} isSending={false} />);

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

  const firstMessages = captures.renders.flatMap(
    (rendered) => rendered.messages,
  );
  const nextStreamingMessage = {
    ...firstStreamingMessage,
    parts: [{ type: "text", text: "hello world" }],
  } satisfies NcpMessage;

  captures.renders = [];
  rerender(
    <ChatMessageListContainer
      messages={[historicalMessage, nextStreamingMessage]}
      isSending={false}
    />,
  );

  const secondMessages = captures.renders.flatMap(
    (rendered) => rendered.messages,
  );

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

  const renderedMessages = captures.renders.flatMap(
    (rendered) => rendered.messages,
  );
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
        args: '{"cmd":"git status"}',
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

  const renderedMessages = captures.renders.flatMap(
    (rendered) => rendered.messages,
  );
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
        args: '{"cmd":"git status"}',
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

it("projects ai execution metadata into the assistant message footer summary", () => {
  const assistantMessage = {
    id: "assistant-execution",
    sessionId: "session-1",
    role: "assistant",
    status: "final",
    timestamp: "2026-03-31T10:01:03.000Z",
    parts: [{ type: "text", text: "Done." }],
    metadata: {
      ai_execution: {
        version: 1,
        runId: "run-1",
        runtimeId: "native",
        model: "openai/gpt-5",
        requestedModel: null,
        outcome: "completed",
        usage: {
          inputTokens: 1_200,
          outputTokens: 200,
          cachedInputTokens: 500,
          totalTokens: 1_400,
          modelCallCount: 1,
          reportedModelCallCount: 1,
          status: "reported",
        },
      },
    },
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
    executionSummaryLabel:
      "openai/gpt-5 · 1.2k chatAiExecutionInput / 200 chatAiExecutionOutput",
    moreActions: {
      triggerLabel: "chatMessageMoreActions",
      items: [
        {
          key: "ai-execution-metadata",
          label: "chatAiExecutionViewMetadata",
          dialog: {
            rows: expect.arrayContaining([
              {
                label: "chatAiExecutionCachedInputTokens",
                value: "500",
              },
            ]),
          },
        },
      ],
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

it("opens workspace file and directory tokens from the message", () => {
  captures.selectedSession = {
    projectRoot: "/tmp/project",
    workingDir: "/tmp/project/packages/ui",
  };
  render(<ChatMessageListContainer messages={[]} isSending={false} />);
  const onInlineTokenClick =
    captures.renders[captures.renders.length - 1]?.onInlineTokenClick;

  onInlineTokenClick?.({
    kind: "workspace_file",
    key: "docs/guide.md",
    label: "guide.md",
    rawText: "@file:docs%2Fguide.md",
  });
  onInlineTokenClick?.({
    kind: "workspace_directory",
    key: "packages/server",
    label: "server",
    rawText: "@folder:packages%2Fserver",
  });

  expect(captures.openFilePreview).toHaveBeenNthCalledWith(1, {
    path: "/tmp/project/docs/guide.md",
    label: "guide.md",
    viewMode: "preview",
  });
  expect(captures.openFilePreview).toHaveBeenNthCalledWith(2, {
    path: "/tmp/project/packages/server",
    label: "server",
    viewMode: "preview",
  });
});

it("opens panel app tokens through the existing content owner", () => {
  render(<ChatMessageListContainer messages={[]} isSending={false} />);
  captures.renders[captures.renders.length - 1]?.onInlineTokenClick?.({
    kind: "panel_app",
    key: "task-board",
    label: "Task Board",
    rawText: "@panel-app:task-board",
  });

  expect(captures.showContent).toHaveBeenCalledWith({
    target: { type: "panel_app", payload: { appId: "task-board" } },
  });
});

it("opens message attachments in the workspace file preview", () => {
  const message = {
    id: "assistant-attachment",
    sessionId: "session-1",
    role: "assistant",
    status: "final",
    timestamp: "2026-03-31T10:05:00.000Z",
    parts: [
      {
        type: "file",
        name: "spec.pdf",
        mimeType: "application/pdf",
        contentBase64: "cGRm",
      },
    ],
  } satisfies NcpMessage;

  render(<ChatMessageListContainer messages={[message]} isSending={false} />);
  captures.renders[captures.renders.length - 1]?.onAttachmentOpen?.({
    label: "spec.pdf",
    mimeType: "application/pdf",
    dataUrl: "data:application/pdf;base64,cGRm",
    isImage: false,
  });

  expect(captures.openFilePreview).toHaveBeenCalledWith({
    path: "spec.pdf",
    label: "spec.pdf",
    viewMode: "preview",
    contentUrl: "data:application/pdf;base64,cGRm",
    mimeType: "application/pdf",
  });
  expect(captures.showContent).not.toHaveBeenCalled();
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
  const renderedMessages = captures.renders.flatMap(
    (rendered) => rendered.messages,
  );
  const renderedPayload = JSON.stringify(renderedMessages);

  expect(screen.getByText("chatContextInheritanceInherited")).toBeTruthy();
  expect(container.querySelector('[title*="parent-session"]')).toBeTruthy();
  expect(
    container.querySelector('[title*="chatContextInheritanceMessages: 1"]'),
  ).toBeTruthy();
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
        args: '{"pattern":"*.py"}',
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

it("passes localized message presentation texts to the shared chat UI", () => {
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
    reasoningCharacterCountTemplates: {
      inProgress: "chatReasoningInProgressCharacterCount",
      completed: "chatReasoningCompletedCharacterCount",
    },
    toolStatusLabels: {
      terminal: {
        running: "chatToolTerminalRunning",
        success: "chatToolTerminalSuccess",
        error: "chatToolTerminalError",
        cancelled: "chatToolTerminalCancelled",
      },
      fileEdit: {
        running: "chatToolFileEditRunning",
        success: "chatToolFileEditSuccess",
        error: "chatToolFileEditError",
        cancelled: "chatToolFileEditCancelled",
      },
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

  expect(
    captures.renders[captures.renders.length - 1]?.renderPanelAppCard,
  ).toEqual(expect.any(Function));
});

it("passes the rendered session runtime icon to assistant messages", () => {
  captures.selectedSession = {
    projectRoot: "/tmp/project",
    sessionType: "codex",
  };
  useChatQueryStore.setState({
    snapshot: {
      sessionTypesQuery: {
        data: {
          defaultType: "native",
          options: [
            {
              value: "codex",
              label: "Codex",
              icon: {
                kind: "image",
                src: "https://example.com/codex.png",
                alt: "Codex",
              },
            },
          ],
        },
      } as never,
    },
  });

  render(
    <ChatMessageListContainer
      messages={[]}
      isSending={false}
      sessionKey="session-codex"
    />,
  );

  expect(captures.selectedSessionKeys).toContain("session-codex");

  const assistantAvatarIcon =
    captures.renders[captures.renders.length - 1]?.assistantAvatarIcon;
  if (!isValidElement(assistantAvatarIcon)) {
    throw new Error("Expected the runtime assistant avatar icon");
  }
  render(assistantAvatarIcon);

  expect(
    screen.getByRole("img", { name: "Codex logo" }).getAttribute("src"),
  ).toBe("https://example.com/codex.png");
});

it("connects inline HTML actions to the chat thread manager", () => {
  render(<ChatMessageListContainer messages={[]} isSending={false} />);

  const renderInlineDisplay =
    captures.renders[captures.renders.length - 1]?.renderInlineDisplay;

  expect(renderInlineDisplay).toEqual(expect.any(Function));
  const rendered = renderInlineDisplay?.({
    target: {
      type: "file",
      payload: { path: "preview.html", viewer: "rendered" },
    },
    title: "Preview",
    description: "Rendered HTML",
  });

  if (!isValidElement(rendered)) {
    throw new Error("Expected inline file renderer to return a React element");
  }
  render(rendered);

  fireEvent.click(screen.getByLabelText("chatPanelCardExpand"));
  fireEvent.click(screen.getByLabelText("chatWorkspaceOpenSource"));

  expect(captures.openFilePreview).toHaveBeenNthCalledWith(1, {
    path: "preview.html",
    label: "Preview",
    viewMode: "preview",
    previewViewer: "rendered",
    line: undefined,
    column: undefined,
  });
  expect(captures.openFilePreview).toHaveBeenNthCalledWith(2, {
    path: "preview.html",
    label: "Preview",
    viewMode: "preview",
    previewViewer: "source",
    line: undefined,
    column: undefined,
  });
});

it("keeps inline panel app displays expandable from the card header", () => {
  render(<ChatMessageListContainer messages={[]} isSending={false} />);

  const renderInlineDisplay =
    captures.renders[captures.renders.length - 1]?.renderInlineDisplay;
  const rendered = renderInlineDisplay?.({
    target: {
      type: "panel_app",
      payload: { appId: "weather-card" },
    },
    title: "Weather",
  });

  if (!isValidElement<{ showExpandAction?: boolean }>(rendered)) {
    throw new Error(
      "Expected inline panel app renderer to return a React element",
    );
  }
  expect(rendered.props.showExpandAction).toBeUndefined();
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
    parts: [{ type: "text", text: "Earlier context was auto-compacted" }],
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
