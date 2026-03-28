import { ToolInvocationStatus, type UiMessage } from "@nextclaw/agent-chat";
import { adaptChatMessages } from "@/components/chat/adapters/chat-message.adapter";
import type { ChatMessageSource } from "@/components/chat/adapters/chat-message.adapter";

function toSource(uiMessages: UiMessage[]): ChatMessageSource[] {
  return uiMessages as unknown as ChatMessageSource[];
}

const defaultTexts = {
  roleLabels: {
    user: "You",
    assistant: "Assistant",
    tool: "Tool",
    system: "System",
    fallback: "Message",
  },
  reasoningLabel: "Reasoning",
  toolCallLabel: "Tool Call",
  toolResultLabel: "Tool Result",
  toolInputLabel: "Input Summary",
  toolCallIdLabel: "Call ID",
  toolNoOutputLabel: "No output",
  toolOutputLabel: "View Output",
  toolStatusPreparingLabel: "Preparing",
  toolStatusRunningLabel: "Running",
  toolStatusCompletedLabel: "Completed",
  toolStatusFailedLabel: "Failed",
  toolStatusCancelledLabel: "Cancelled",
  imageAttachmentLabel: "Image attachment",
  fileAttachmentLabel: "File attachment",
  unknownPartLabel: "Unknown Part",
};

function adapt(uiMessages: ChatMessageSource[]) {
  return adaptChatMessages({
    uiMessages,
    formatTimestamp: (value) => `formatted:${value}`,
    texts: defaultTexts,
  });
}

it("maps markdown, reasoning, and tool parts into UI view models", () => {
  const messages: UiMessage[] = [
    {
      id: "assistant-1",
      role: "assistant",
      meta: {
        status: "final",
        timestamp: "2026-03-17T10:00:00.000Z",
      },
      parts: [
        { type: "text", text: "hello world" },
        {
          type: "reasoning",
          reasoning: "internal reasoning",
          details: [],
        },
        {
          type: "tool-invocation",
          toolInvocation: {
            status: ToolInvocationStatus.RESULT,
            toolCallId: "call-1",
            toolName: "web_search",
            args: '{"q":"hello"}',
            result: { ok: true },
          },
        },
      ],
    },
  ];

  const adapted = adapt(toSource(messages));

  expect(adapted).toHaveLength(1);
  expect(adapted[0]?.roleLabel).toBe("Assistant");
  expect(adapted[0]?.timestampLabel).toBe("formatted:2026-03-17T10:00:00.000Z");
  expect(adapted[0]?.parts.map((part) => part.type)).toEqual([
    "markdown",
    "reasoning",
    "tool-card",
  ]);
  expect(adapted[0]?.parts[1]).toMatchObject({
    type: "reasoning",
    label: "Reasoning",
    text: "internal reasoning",
  });
  expect(adapted[0]?.parts[2]).toMatchObject({
    type: "tool-card",
    card: {
      callId: "call-1",
      callIdLabel: "Call ID",
      inputLabel: "Input Summary",
      statusLabel: "Completed",
      statusTone: "success",
      titleLabel: "Tool Result",
      outputLabel: "View Output",
    },
  });
});

it("maps tool lifecycle statuses into visible card state feedback", () => {
  const adapted = adapt([
    {
      id: "assistant-tool-statuses",
      role: "assistant",
      parts: [
        {
          type: "tool-invocation",
          toolInvocation: {
            status: ToolInvocationStatus.PARTIAL_CALL,
            toolCallId: "call-prep",
            toolName: "web_search",
            args: '{"q":"latest"}',
          },
        },
        {
          type: "tool-invocation",
          toolInvocation: {
            status: ToolInvocationStatus.ERROR,
            toolCallId: "call-error",
            toolName: "exec_command",
            args: '{"cmd":"exit 1"}',
            error: "Command failed",
          },
        },
      ],
    },
  ] as unknown as ChatMessageSource[]);

  expect(adapted[0]?.parts[0]).toMatchObject({
    type: "tool-card",
    card: {
      statusTone: "running",
      statusLabel: "Preparing",
      titleLabel: "Tool Call",
      callId: "call-prep",
    },
  });
  expect(adapted[0]?.parts[1]).toMatchObject({
    type: "tool-card",
    card: {
      statusTone: "error",
      statusLabel: "Failed",
      titleLabel: "Tool Result",
      output: "Command failed",
      callId: "call-error",
    },
  });
});

it("maps non-standard roles back to the generic message role", () => {
  const adapted = adapt([
    {
      id: "data-1",
      role: "data",
      parts: [{ type: "text", text: "payload" }],
    },
  ] as unknown as ChatMessageSource[]);

  expect(adapted[0]?.role).toBe("message");
  expect(adapted[0]?.roleLabel).toBe("Message");
});

it("maps unknown parts into a visible fallback part", () => {
  const adapted = adapt([
    {
      id: "x-1",
      role: "assistant",
      parts: [{ type: "step-start", value: "x" }],
    },
  ] as unknown as ChatMessageSource[]);

  expect(adapted[0]?.parts[0]).toMatchObject({
    type: "unknown",
    rawType: "step-start",
    label: "Unknown Part",
  });
});

it("drops empty and zero-width text parts during adaptation", () => {
  const adapted = adapt([
    {
      id: "assistant-mixed",
      role: "assistant",
      parts: [
        { type: "text", text: "   " },
        { type: "text", text: "\u200B\u200B" },
        { type: "text", text: "\u200Bhello\u200B" },
      ],
    },
  ] as unknown as ChatMessageSource[]);

  expect(adapted).toHaveLength(1);
  expect(adapted[0]?.id).toBe("assistant-mixed");
  expect(adapted[0]?.parts).toHaveLength(1);
  expect(adapted[0]?.parts[0]).toMatchObject({
    type: "markdown",
    text: "\u200Bhello\u200B",
  });
});

it("maps file parts into previewable attachment view models", () => {
  const adapted = adapt([
    {
      id: "assistant-file",
      role: "assistant",
      parts: [
        {
          type: "file",
          mimeType: "image/png",
          data: "ZmFrZS1pbWFnZQ==",
          sizeBytes: 4096,
        },
      ],
    },
  ] as unknown as ChatMessageSource[]);

  expect(adapted[0]?.parts[0]).toEqual({
    type: "file",
    file: {
      label: "Image attachment",
      mimeType: "image/png",
      dataUrl: "data:image/png;base64,ZmFrZS1pbWFnZQ==",
      sizeBytes: 4096,
      isImage: true,
    },
  });
});

it("keeps named non-image files as downloadable attachments", () => {
  const adapted = adapt([
    {
      id: "assistant-doc",
      role: "assistant",
      parts: [
        {
          type: "file",
          name: "spec.pdf",
          mimeType: "application/pdf",
          data: "cGRm",
          sizeBytes: 2048,
        },
      ],
    },
  ] as unknown as ChatMessageSource[]);

  expect(adapted[0]?.parts[0]).toEqual({
    type: "file",
    file: {
      label: "spec.pdf",
      mimeType: "application/pdf",
      dataUrl: "data:application/pdf;base64,cGRm",
      sizeBytes: 2048,
      isImage: false,
    },
  });
});

it("renders asset tool results as previewable files", () => {
  const adapted = adapt([
    {
      id: "assistant-asset",
      role: "assistant",
      parts: [
        {
          type: "tool-invocation",
          toolInvocation: {
            status: ToolInvocationStatus.RESULT,
            toolCallId: "call-asset-1",
            toolName: "asset_put",
            args: { path: "/tmp/output.png" },
            result: {
              ok: true,
              asset: {
                uri: "asset://store/2026/03/27/asset_1",
                name: "output.png",
                mimeType: "image/png",
                url: "/api/ncp/assets/content?uri=asset%3A%2F%2Fstore%2F2026%2F03%2F27%2Fasset_1",
                sizeBytes: 5120,
              },
            },
          },
        },
      ],
    },
  ] as unknown as ChatMessageSource[]);

  expect(adapted[0]?.parts[0]).toEqual({
    type: "file",
    file: {
      label: "output.png",
      mimeType: "image/png",
      dataUrl:
        "/api/ncp/assets/content?uri=asset%3A%2F%2Fstore%2F2026%2F03%2F27%2Fasset_1",
      sizeBytes: 5120,
      isImage: true,
    },
  });
});
