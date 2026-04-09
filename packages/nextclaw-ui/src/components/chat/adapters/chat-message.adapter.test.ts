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
  toolInputLabel: "Input",
  toolNoOutputLabel: "No output",
  toolOutputLabel: "Output",
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
      statusLabel: "Completed",
      statusTone: "success",
      titleLabel: "Tool Result",
      outputLabel: "Output",
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

it("renders inline skill tokens as structured inline content parts", () => {
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
    type: "inline-content",
    segments: [
      { type: "markdown", text: "please use " },
      {
        type: "token",
        token: {
          kind: "skill",
          key: "weather",
          label: "Weather",
          rawText: "$weather",
        },
      },
      { type: "markdown", text: " now" },
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

it("builds edit-file previews from structured args before the tool finishes", () => {
  const adapted = adapt([
    {
      id: "assistant-edit-preview",
      role: "assistant",
      parts: [
        {
          type: "tool-invocation",
          toolInvocation: {
            status: ToolInvocationStatus.CALL,
            toolCallId: "edit-call-1",
            toolName: "edit_file",
            args: JSON.stringify({
              path: "src/app.ts",
              oldText: "const color = 'red';",
              newText: "const color = 'blue';",
            }),
            parsedArgs: {
              path: "src/app.ts",
              oldText: "const color = 'red';",
              newText: "const color = 'blue';",
            },
          },
        },
      ],
    },
  ] as unknown as ChatMessageSource[]);

  const editLines =
    adapted[0]?.parts[0]?.type === "tool-card"
      ? (adapted[0].parts[0].card.fileOperation?.blocks[0]?.lines ?? [])
      : [];

  expect(adapted[0]?.parts[0]).toMatchObject({
    type: "tool-card",
    card: {
      toolName: "edit_file",
      summary: "src/app.ts",
      statusTone: "running",
      fileOperation: {
        blocks: [
          {
            path: "src/app.ts",
            lines: [
              {
                kind: "remove",
                text: "const color = 'red';",
              },
              {
                kind: "add",
                text: "const color = 'blue';",
              },
            ],
          },
        ],
      },
    },
  });
  expect(editLines[0]).not.toHaveProperty("oldLineNumber");
  expect(editLines[1]).not.toHaveProperty("newLineNumber");
});

it("uses structured edit-file result line numbers after the tool finishes", () => {
  const adapted = adapt([
    {
      id: "assistant-edit-result",
      role: "assistant",
      parts: [
        {
          type: "tool-invocation",
          toolInvocation: {
            status: ToolInvocationStatus.RESULT,
            toolCallId: "edit-result-1",
            toolName: "edit_file",
            args: JSON.stringify({
              path: "src/app.ts",
              oldText: "const color = 'red';",
              newText: "const color = 'blue';",
            }),
            parsedArgs: {
              path: "src/app.ts",
              oldText: "const color = 'red';",
              newText: "const color = 'blue';",
            },
            result: {
              path: "src/app.ts",
              oldStartLine: 27,
              newStartLine: 27,
              message: "Edited src/app.ts",
            },
          },
        },
      ],
    },
  ] as unknown as ChatMessageSource[]);

  expect(adapted[0]?.parts[0]).toMatchObject({
    type: "tool-card",
    card: {
      toolName: "edit_file",
      summary: "src/app.ts",
      statusTone: "success",
      fileOperation: {
        blocks: [
          {
            path: "src/app.ts",
            lines: [
              {
                kind: "remove",
                text: "const color = 'red';",
                oldLineNumber: 27,
              },
              {
                kind: "add",
                text: "const color = 'blue';",
                newLineNumber: 27,
              },
            ],
          },
        ],
      },
    },
  });
});

it("builds write-file previews from partial native args before the JSON is complete", () => {
  const adapted = adapt([
    {
      id: "assistant-write-preview",
      role: "assistant",
      parts: [
        {
          type: "tool-invocation",
          toolInvocation: {
            status: ToolInvocationStatus.PARTIAL_CALL,
            toolCallId: "write-call-1",
            toolName: "write_file",
            args: '{"path":"games/snake.html","content":"<!DOCTYPE html>\\n<canvas id=\\"game\\"></canvas>\\n<script>const score = 1;',
          },
        },
      ],
    },
  ] as unknown as ChatMessageSource[]);

  expect(adapted[0]?.parts[0]).toMatchObject({
    type: "tool-card",
    card: {
      toolName: "write_file",
      summary: "games/snake.html",
      statusTone: "running",
      statusLabel: "Running",
      fileOperation: {
        blocks: [
          {
            display: "preview",
            path: "games/snake.html",
            lines: expect.arrayContaining([
              expect.objectContaining({
                kind: "add",
                text: "<!DOCTYPE html>",
              }),
              expect.objectContaining({
                kind: "add",
                text: '<canvas id="game"></canvas>',
              }),
            ]),
          },
        ],
      },
    },
  });
});

it("keeps completed write-file cards in preview mode instead of falling back to raw byte summaries", () => {
  const adapted = adapt([
    {
      id: "assistant-write-result",
      role: "assistant",
      parts: [
        {
          type: "tool-invocation",
          toolInvocation: {
            status: ToolInvocationStatus.RESULT,
            toolCallId: "write-result-1",
            toolName: "write_file",
            args: JSON.stringify({
              path: "games/snake.html",
              content: '<!DOCTYPE html>\n<canvas id="game"></canvas>',
            }),
            result: "Wrote 3906 bytes to games/snake.html",
          },
        },
      ],
    },
  ] as unknown as ChatMessageSource[]);

  expect(adapted[0]?.parts[0]).toMatchObject({
    type: "tool-card",
    card: {
      toolName: "write_file",
      summary: "games/snake.html",
      statusTone: "success",
      fileOperation: {
        blocks: [
          {
            display: "preview",
            path: "games/snake.html",
            lines: [
              {
                kind: "add",
                text: "<!DOCTYPE html>",
                newLineNumber: 1,
              },
              {
                kind: "add",
                text: '<canvas id="game"></canvas>',
                newLineNumber: 2,
              },
            ],
          },
        ],
      },
    },
  });
  expect(adapted[0]?.parts[0]).not.toMatchObject({
    type: "tool-card",
    card: {
      output: "Wrote 3906 bytes to games/snake.html",
    },
  });
});

it("renders codex file_change results as structured diff previews", () => {
  const adapted = adapt([
    {
      id: "assistant-file-change",
      role: "assistant",
      parts: [
        {
          type: "tool-invocation",
          toolInvocation: {
            status: ToolInvocationStatus.RESULT,
            toolCallId: "file-change-1",
            toolName: "file_change",
            args: JSON.stringify({
              changes: [
                {
                  path: "src/main.ts",
                  diff: [
                    "--- a/src/main.ts",
                    "+++ b/src/main.ts",
                    "@@ -109,1 +109,1 @@",
                    "-console.log('old');",
                    "+console.log('new');",
                  ].join("\n"),
                },
              ],
            }),
            result: {
              status: "completed",
              changes: [
                {
                  path: "src/main.ts",
                  diff: [
                    "--- a/src/main.ts",
                    "+++ b/src/main.ts",
                    "@@ -109,1 +109,1 @@",
                    "-console.log('old');",
                    "+console.log('new');",
                  ].join("\n"),
                },
              ],
            },
          },
        },
      ],
    },
  ] as unknown as ChatMessageSource[]);

  expect(adapted[0]?.parts[0]).toMatchObject({
    type: "tool-card",
    card: {
      toolName: "file_change",
      summary: "src/main.ts",
      statusTone: "success",
      fileOperation: {
        blocks: [
          {
            path: "src/main.ts",
            lines: [
              {
                kind: "remove",
                text: "console.log('old');",
                oldLineNumber: 109,
              },
              {
                kind: "add",
                text: "console.log('new');",
                newLineNumber: 109,
              },
            ],
          },
        ],
      },
    },
  });
});
