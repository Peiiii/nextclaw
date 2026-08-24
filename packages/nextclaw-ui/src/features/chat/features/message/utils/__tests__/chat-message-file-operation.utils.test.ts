import { ToolInvocationStatus } from "@nextclaw/agent-chat";
import { adapt, type ChatMessageSource } from "./chat-message-test.utils";

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

it("keeps incomplete edit-file arguments available before preview fields arrive", () => {
  const partialArgs = '{"path":"src/app.ts","oldText":';
  const adapted = adapt([
    {
      id: "assistant-partial-edit-input",
      role: "assistant",
      parts: [
        {
          type: "tool-invocation",
          toolInvocation: {
            status: ToolInvocationStatus.PARTIAL_CALL,
            toolCallId: "edit-partial-1",
            toolName: "edit_file",
            args: partialArgs,
          },
        },
      ],
    },
  ] as unknown as ChatMessageSource[]);

  expect(adapted[0]?.parts[0]).toMatchObject({
    type: "tool-card",
    card: {
      toolName: "edit_file",
      input: partialArgs,
      statusTone: "running",
    },
  });
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
  expect(adapted[0]?.parts[0]).not.toMatchObject({
    type: "tool-card",
    card: {
      outputData: expect.anything(),
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
  expect(adapted[0]?.parts[0]).not.toMatchObject({
    type: "tool-card",
    card: {
      outputData: expect.anything(),
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
  expect(adapted[0]?.parts[0]).not.toMatchObject({
    type: "tool-card",
    card: {
      outputData: expect.anything(),
    },
  });
});

it("uses a read-file preview as the single visible representation of file content", () => {
  const adapted = adapt([
    {
      id: "assistant-read-result",
      role: "assistant",
      parts: [
        {
          type: "tool-invocation",
          toolInvocation: {
            status: ToolInvocationStatus.RESULT,
            toolCallId: "read-result-1",
            toolName: "read_file",
            args: JSON.stringify({ path: "docs/readme.md" }),
            parsedArgs: { path: "docs/readme.md" },
            result: "1: first line\n2: second line\n</content>",
          },
        },
      ],
    },
  ] as unknown as ChatMessageSource[]);

  expect(adapted[0]?.parts[0]).toMatchObject({
    type: "tool-card",
    card: {
      toolName: "read_file",
      summary: "docs/readme.md",
      fileOperation: {
        blocks: [
          {
            display: "preview",
            path: "docs/readme.md",
            lines: expect.arrayContaining([
              expect.objectContaining({ text: "1: first line" }),
              expect.objectContaining({ text: "2: second line" }),
            ]),
          },
        ],
      },
    },
  });
  expect(adapted[0]?.parts[0]).not.toMatchObject({
    type: "tool-card",
    card: {
      outputData: expect.anything(),
    },
  });
});

it("uses an apply-patch preview as the single visible representation of the patch", () => {
  const patch = [
    "*** Begin Patch",
    "*** Update File: src/app.ts",
    "@@",
    "-const color = 'red';",
    "+const color = 'blue';",
    "*** End Patch",
  ].join("\n");
  const adapted = adapt([
    {
      id: "assistant-apply-patch-result",
      role: "assistant",
      parts: [
        {
          type: "tool-invocation",
          toolInvocation: {
            status: ToolInvocationStatus.RESULT,
            toolCallId: "apply-patch-result-1",
            toolName: "apply_patch",
            args: patch,
            result: "Done!",
          },
        },
      ],
    },
  ] as unknown as ChatMessageSource[]);

  expect(adapted[0]?.parts[0]).toMatchObject({
    type: "tool-card",
    card: {
      toolName: "apply_patch",
      summary: "src/app.ts",
      fileOperation: {
        blocks: [
          {
            path: "src/app.ts",
            lines: [
              expect.objectContaining({ kind: "remove", text: "const color = 'red';" }),
              expect.objectContaining({ kind: "add", text: "const color = 'blue';" }),
            ],
          },
        ],
      },
    },
  });
  expect(adapted[0]?.parts[0]).not.toMatchObject({
    type: "tool-card",
    card: {
      outputData: expect.anything(),
    },
  });
});

it("keeps raw file-tool results when no structured preview can be built", () => {
  const adapted = adapt([
    {
      id: "assistant-read-result-without-path",
      role: "assistant",
      parts: [
        {
          type: "tool-invocation",
          toolInvocation: {
            status: ToolInvocationStatus.RESULT,
            toolCallId: "read-result-without-path-1",
            toolName: "read_file",
            result: "raw file content",
          },
        },
      ],
    },
  ] as unknown as ChatMessageSource[]);

  expect(adapted[0]?.parts[0]).toMatchObject({
    type: "tool-card",
    card: {
      toolName: "read_file",
      outputData: "raw file content",
    },
  });
});

it("keeps file-tool errors visible even when input can build a preview", () => {
  const adapted = adapt([
    {
      id: "assistant-write-error",
      role: "assistant",
      parts: [
        {
          type: "tool-invocation",
          toolInvocation: {
            status: ToolInvocationStatus.RESULT,
            toolCallId: "write-error-1",
            toolName: "write_file",
            parsedArgs: {
              path: "src/app.ts",
              content: "const color = 'blue';",
            },
            error: "Permission denied",
            result: "write failed",
          },
        },
      ],
    },
  ] as unknown as ChatMessageSource[]);

  expect(adapted[0]?.parts[0]).toMatchObject({
    type: "tool-card",
    card: {
      toolName: "write_file",
      statusTone: "error",
      output: "Permission denied",
      outputData: "write failed",
      fileOperation: {
        blocks: [expect.objectContaining({ path: "src/app.ts" })],
      },
    },
  });
});
