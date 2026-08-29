import { ToolInvocationStatus, type UiMessage } from "@nextclaw/agent-chat";
import { adapt, toSource, type ChatMessageSource } from "./chat-message-test.utils";

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
      statusLabel: "Completed",
      statusTone: "success",
      titleLabel: "Tool Result",
      outputLabel: "Output",
    },
  });
});

it("preserves the prepared execution summary on the message view model", () => {
  const adapted = adapt([{
    id: "assistant-execution",
    role: "assistant",
    meta: {
      executionSummaryLabel: "openai/gpt-5 · 120 input / 30 output",
      moreActions: {
        triggerLabel: "More actions",
        items: [
          {
            key: "metadata",
            label: "View metadata",
            dialog: {
              title: "Metadata",
              closeLabel: "Close",
              rows: [{ label: "Model", value: "openai/gpt-5" }],
            },
          },
        ],
      },
    },
    parts: [{ type: "text", text: "done" }],
  }]);

  expect(adapted[0]?.executionSummaryLabel).toBe(
    "openai/gpt-5 · 120 input / 30 output",
  );
  expect(adapted[0]?.moreActions?.items[0]?.dialog.rows[0]).toEqual({
    label: "Model",
    value: "openai/gpt-5",
  });
});

it("maps context compaction extensions into stable process parts", () => {
  const adapted = adapt([{
    id: "assistant-compaction",
    role: "assistant",
    parts: [{
      type: "extension",
      extensionType: "nextclaw.context-compaction",
      data: {
        id: "context-compaction-message-1",
        checkpoint: { id: "checkpoint-1", status: "compressed" },
      },
    }],
  }]);

  expect(adapted[0]?.parts).toEqual([{
    type: "custom",
    id: "context-compaction-message-1",
    customType: "nextclaw.context-compaction",
    data: {
      id: "context-compaction-message-1",
      checkpoint: { id: "checkpoint-1", status: "compressed" },
    },
    process: true,
  }]);
});

it("maps observation event extensions into visible custom parts", () => {
  const adapted = adapt([{
    id: "observation-event-message-1",
    role: "system",
    parts: [{
      type: "extension",
      extensionType: "observation.event",
      data: {
        deliveryId: "delivery-1",
        extensionId: "calendar-extension",
        eventId: "event-1",
        eventType: "calendar.event.created",
        occurredAt: "2026-08-23T10:00:00.000Z",
        payload: { title: "Planning" },
      },
    }],
  }]);

  expect(adapted[0]?.role).toBe("system");
  expect(adapted[0]?.parts).toEqual([{
    type: "custom",
    id: "delivery-1",
    customType: "observation.event",
    data: {
      deliveryId: "delivery-1",
      extensionId: "calendar-extension",
      eventId: "event-1",
      eventType: "calendar.event.created",
      occurredAt: "2026-08-23T10:00:00.000Z",
      payload: { title: "Planning" },
    },
  }]);
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
      statusLabel: "Running",
      titleLabel: "Tool Call",
    },
  });
  expect(adapted[0]?.parts[1]).toMatchObject({
    type: "tool-card",
    card: {
      statusTone: "error",
      statusLabel: "Failed",
      titleLabel: "Tool Result",
      output: "Command failed",
    },
  });
});

it("preserves full generic tool args for the expanded body while keeping the header summary short", () => {
  const adapted = adapt([
    {
      id: "assistant-generic-tool-input",
      role: "assistant",
      parts: [
        {
          type: "tool-invocation",
          toolInvocation: {
            status: ToolInvocationStatus.PARTIAL_CALL,
            toolCallId: "call-generic-input",
            toolName: "open_url",
            args: JSON.stringify({
              url: "https://example.com/really/long/path",
              headers: {
                authorization: "Bearer secret-token",
              },
              mode: "reader",
            }),
          },
        },
      ],
    },
  ] as unknown as ChatMessageSource[]);

  expect(adapted[0]?.parts[0]).toMatchObject({
    type: "tool-card",
    card: {
      toolName: "open_url",
      statusTone: "running",
      summary: "url: https://example.com/really/long/path",
      input: `{
  "url": "https://example.com/really/long/path",
  "headers": {
    "authorization": "Bearer secret-token"
  },
  "mode": "reader"
}`,
    },
  });
});

it("keeps structured terminal results as structured data instead of raw json output", () => {
  const terminalResult = {
    status: "completed",
    command: "python3 -m http.server 8765",
    aggregated_output: "",
    exit_code: 0,
  };

  const adapted = adapt([
    {
      id: "assistant-terminal-result",
      role: "assistant",
      parts: [
        {
          type: "tool-invocation",
          toolInvocation: {
            status: ToolInvocationStatus.RESULT,
            toolCallId: "call-terminal-result",
            toolName: "command_execution",
            args: '{"command":"python3 -m http.server 8765"}',
            result: terminalResult,
          },
        },
      ],
    },
  ] as unknown as ChatMessageSource[]);

  expect(adapted[0]?.parts[0]).toMatchObject({
    type: "tool-card",
    card: {
      toolName: "command_execution",
      summary: "command: python3 -m http.server 8765",
      output: undefined,
      outputData: terminalResult,
      statusTone: "success",
    },
  });
});

it("renders child-session request cards for sessions_spawn when the new child starts immediately", () => {
  const adapted = adapt([
    {
      id: "assistant-subagent",
      role: "assistant",
      parts: [
        {
          type: "tool-invocation",
          toolInvocation: {
            status: ToolInvocationStatus.RESULT,
            toolCallId: "sessions-spawn-call-1",
            toolName: "sessions_spawn",
            args: '{"scope":"child","title":"Verifier","task":"Verify 1+1=2","request":{"notify":"final_reply"}}',
            result: {
              kind: "nextclaw.session_request",
              requestId: "request-1",
              sessionId: "child-session-1",
              agentId: "verifier-agent",
              isChildSession: true,
              lifecycle: "persistent",
              title: "Verifier",
              task: "Verify 1+1=2",
              status: "completed",
              notify: "final_reply",
              wait: "none",
              spawnedByRequestId: "request-1",
              finalResponseText: "Verified 1+1=2.",
              parentSessionId: "parent-session-1",
            },
          },
        },
      ],
    },
  ] as unknown as ChatMessageSource[]);

  expect(adapted[0]?.parts[0]).toMatchObject({
    type: "tool-card",
    card: {
      toolName: "sessions_spawn",
      agentId: "verifier-agent",
      summary: "title: Verifier · session: child-session-1 · task: Verify 1+1=2",
      input: `{
  "scope": "child",
  "title": "Verifier",
  "task": "Verify 1+1=2",
  "request": {
    "notify": "final_reply"
  }
}`,
      output: [
        "Request ID: request-1",
        "",
        "Session ID: child-session-1",
        "",
        "Target: child",
        "",
        "Status: completed",
        "",
        "Notify: final_reply",
        "",
        "Wait: none",
        "",
        "Lifecycle: persistent",
        "",
        "Parent Session ID: parent-session-1",
        "",
        "Spawned By Request ID: request-1",
        "",
        "Title: Verifier",
        "",
        "Task:",
        "Verify 1+1=2",
        "",
        "Final Response:",
        "Verified 1+1=2.",
      ].join("\n"),
      statusTone: "success",
      statusLabel: "Completed",
      titleLabel: "Tool Result",
      action: {
        kind: "open-session",
        sessionId: "child-session-1",
        sessionKind: "child",
        agentId: "verifier-agent",
        label: "Verifier",
        parentSessionId: "parent-session-1",
      },
    },
  });
});

it("renders regular session request tool cards with session navigation instead of child navigation", () => {
  const adapted = adapt([
    {
      id: "assistant-session-request",
      role: "assistant",
      parts: [
        {
          type: "tool-invocation",
          toolInvocation: {
            status: ToolInvocationStatus.RESULT,
            toolCallId: "session-request-call-1",
            toolName: "sessions_request",
            args: '{"target":{"session_id":"session-2"},"task":"Summarize the latest findings","notify":"none","title":"Research thread"}',
            result: {
              kind: "nextclaw.session_request",
              requestId: "request-2",
              sessionId: "session-2",
              agentId: "research-agent",
              isChildSession: false,
              lifecycle: "persistent",
              title: "Research thread",
              task: "Summarize the latest findings",
              status: "completed",
              notify: "none",
              wait: "none",
              finalResponseText: "Here is the summary.",
            },
          },
        },
      ],
    },
  ] as unknown as ChatMessageSource[]);

  expect(adapted[0]?.parts[0]).toMatchObject({
    type: "tool-card",
    card: {
      toolName: "sessions_request",
      agentId: "research-agent",
      summary: "title: Research thread · session: session-2 · task: Summarize the latest findings",
      input: `{
  "target": {
    "session_id": "session-2"
  },
  "task": "Summarize the latest findings",
  "notify": "none",
  "title": "Research thread"
}`,
      output: [
        "Request ID: request-2",
        "",
        "Session ID: session-2",
        "",
        "Target: session",
        "",
        "Status: completed",
        "",
        "Notify: none",
        "",
        "Wait: none",
        "",
        "Lifecycle: persistent",
        "",
        "Title: Research thread",
        "",
        "Task:",
        "Summarize the latest findings",
        "",
        "Final Response:",
        "Here is the summary.",
      ].join("\n"),
      statusTone: "success",
      action: {
        kind: "open-session",
        sessionId: "session-2",
        sessionKind: "session",
        agentId: "research-agent",
        label: "Research thread",
      },
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

it("attaches inline skill tokens to markdown parts", () => {
  const adapted = adapt([
    {
      id: "user-inline-skill",
      role: "user",
      meta: {
        inlineTokens: [
          {
            kind: "skill",
            key: "weather",
            label: "Weather",
            rawText: "$weather",
          },
        ],
      },
      parts: [{ type: "text", text: "please use $weather now" }],
    },
  ] as unknown as ChatMessageSource[]);

  expect(adapted[0]?.parts[0]).toEqual({
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
  });
});

it("attaches inline panel app text protocol tokens without metadata", () => {
  const adapted = adapt([
    {
      id: "user-inline-panel-app",
      role: "user",
      parts: [{ type: "text", text: "review @panel-app:task-board now" }],
    },
  ] as unknown as ChatMessageSource[]);

  expect(adapted[0]?.parts[0]).toEqual({
    type: "markdown",
    text: "review @panel-app:task-board now",
    inlineTokens: [
      {
        kind: "panel_app",
        key: "task-board",
        label: "task-board",
        rawText: "@panel-app:task-board",
      },
    ],
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
