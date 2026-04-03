import {
  adaptNcpMessageToUiMessage,
  adaptNcpSessionSummary,
  readNcpSessionPreferredThinking
} from '@/components/chat/ncp/ncp-session-adapter';
import { adaptChatMessage } from '@/components/chat/adapters/chat-message.adapter';
import type { NcpSessionSummaryView } from '@/api/types';

function createSummary(partial: Partial<NcpSessionSummaryView> = {}): NcpSessionSummaryView {
  return {
    sessionId: 'ncp-session-1',
    messageCount: 3,
    updatedAt: '2026-03-18T00:00:00.000Z',
    status: 'idle',
    ...partial
  };
}

describe('adaptNcpSessionSummary', () => {
  it('maps session metadata into shared session entry fields', () => {
    const adapted = adaptNcpSessionSummary(
      createSummary({
        metadata: {
          label: 'NCP Planning Thread',
          model: 'openai/gpt-5',
          preferred_thinking: 'medium',
          project_root: '/Users/demo/workspace/project-alpha',
          session_type: 'native'
        }
      })
    );

    expect(adapted).toMatchObject({
      key: 'ncp-session-1',
      label: 'NCP Planning Thread',
      preferredModel: 'openai/gpt-5',
      preferredThinking: 'medium',
      projectRoot: '/Users/demo/workspace/project-alpha',
      projectName: 'project-alpha',
      sessionType: 'native',
      sessionTypeMutable: false,
      isChildSession: false,
      messageCount: 3
    });
  });

  it('marks child sessions from parent_session_id metadata and keeps the request link', () => {
    const adapted = adaptNcpSessionSummary(
      createSummary({
        metadata: {
          label: 'Verifier',
          session_type: 'native',
          parent_session_id: 'parent-session-1',
          spawned_by_request_id: 'request-1',
        },
      }),
    );

    expect(adapted).toMatchObject({
      key: 'ncp-session-1',
      isChildSession: true,
      parentSessionId: 'parent-session-1',
      spawnedByRequestId: 'request-1',
    });
  });
});

describe('adaptNcpMessageToUiMessage', () => {
  it('preserves mixed text and image part order for message rendering', () => {
    const adapted = adaptNcpMessageToUiMessage({
      id: 'ncp-message-1',
      sessionId: 'ncp-session-1',
      role: 'user',
      status: 'final',
      timestamp: '2026-03-25T00:00:00.000Z',
      parts: [
        { type: 'text', text: 'before ' },
        {
          type: 'file',
          name: 'sample.png',
          mimeType: 'image/png',
          contentBase64: 'ZmFrZS1pbWFnZQ==',
          sizeBytes: 10
        },
        { type: 'text', text: ' after' }
      ]
    });

    expect(adapted.parts).toEqual([
      {
        type: 'text',
        text: 'before '
      },
      {
        type: 'file',
        name: 'sample.png',
        mimeType: 'image/png',
        data: 'ZmFrZS1pbWFnZQ==',
        sizeBytes: 10
      },
      {
        type: 'text',
        text: ' after'
      }
    ]);
  });

  it('keeps streamed native file tool args renderable as a preview before the tool result arrives', () => {
    const uiMessage = adaptNcpMessageToUiMessage({
      id: 'ncp-message-tool-1',
      sessionId: 'ncp-session-1',
      role: 'assistant',
      status: 'streaming',
      timestamp: '2026-04-01T00:00:00.000Z',
      parts: [
        {
          type: 'tool-invocation',
          toolCallId: 'tool-edit-1',
          toolName: 'edit_file',
          state: 'partial-call',
          args: JSON.stringify({
            path: 'src/app.ts',
            oldText: 'const count = 1;',
            newText: 'const count = 2;',
          }),
        },
      ],
    });

    const adapted = adaptChatMessage(
      {
        id: uiMessage.id,
        role: uiMessage.role,
        meta: {
          timestamp: uiMessage.meta?.timestamp,
          status: uiMessage.meta?.status,
        },
        parts: uiMessage.parts as never,
      },
      {
        formatTimestamp: (value) => value ?? '',
        texts: {
          roleLabels: {
            user: 'User',
            assistant: 'Assistant',
            tool: 'Tool',
            system: 'System',
            fallback: 'Message',
          },
          reasoningLabel: 'Reasoning',
          toolCallLabel: 'Tool Call',
          toolResultLabel: 'Tool Result',
          toolInputLabel: 'Input',
          toolNoOutputLabel: 'No output',
          toolOutputLabel: 'Output',
          toolStatusPreparingLabel: 'Preparing',
          toolStatusRunningLabel: 'Running',
          toolStatusCompletedLabel: 'Completed',
          toolStatusFailedLabel: 'Failed',
          toolStatusCancelledLabel: 'Cancelled',
          imageAttachmentLabel: 'Image',
          fileAttachmentLabel: 'File',
          unknownPartLabel: 'Unknown',
        },
      },
    );

    expect(adapted.parts[0]).toMatchObject({
      type: 'tool-card',
      card: {
        toolName: 'edit_file',
        summary: 'src/app.ts',
        statusTone: 'running',
        fileOperation: {
          blocks: [
            {
              path: 'src/app.ts',
              lines: [
                {
                  kind: 'remove',
                  text: 'const count = 1;',
                },
                {
                  kind: 'add',
                  text: 'const count = 2;',
                },
              ],
            },
          ],
        },
      },
    });
  });

  it('downgrades large streamed write_file payloads into a lightweight preview block', () => {
    const largeContent = Array.from({ length: 300 }, (_, index) => `line ${index + 1}`).join('\n');
    const uiMessage = adaptNcpMessageToUiMessage({
      id: 'ncp-message-tool-write-1',
      sessionId: 'ncp-session-1',
      role: 'assistant',
      status: 'streaming',
      timestamp: '2026-04-01T00:00:00.000Z',
      parts: [
        {
          type: 'tool-invocation',
          toolCallId: 'tool-write-1',
          toolName: 'write_file',
          state: 'partial-call',
          args: JSON.stringify({
            path: 'src/game.html',
            content: largeContent,
          }),
        },
      ],
    });

    const adapted = adaptChatMessage(
      {
        id: uiMessage.id,
        role: uiMessage.role,
        meta: {
          timestamp: uiMessage.meta?.timestamp,
          status: uiMessage.meta?.status,
        },
        parts: uiMessage.parts as never,
      },
      {
        formatTimestamp: (value) => value ?? '',
        texts: {
          roleLabels: {
            user: 'User',
            assistant: 'Assistant',
            tool: 'Tool',
            system: 'System',
            fallback: 'Message',
          },
          reasoningLabel: 'Reasoning',
          toolCallLabel: 'Tool Call',
          toolResultLabel: 'Tool Result',
          toolInputLabel: 'Input',
          toolNoOutputLabel: 'No output',
          toolOutputLabel: 'Output',
          toolStatusPreparingLabel: 'Preparing',
          toolStatusRunningLabel: 'Running',
          toolStatusCompletedLabel: 'Completed',
          toolStatusFailedLabel: 'Failed',
          toolStatusCancelledLabel: 'Cancelled',
          imageAttachmentLabel: 'Image',
          fileAttachmentLabel: 'File',
          unknownPartLabel: 'Unknown',
        },
      },
    );

    expect(adapted.parts[0]).toMatchObject({
      type: 'tool-card',
      card: {
        toolName: 'write_file',
        summary: 'src/game.html',
        statusTone: 'running',
        fileOperation: {
          blocks: expect.arrayContaining([
            expect.objectContaining({
              path: 'src/game.html',
              display: 'preview',
              lines: expect.arrayContaining([
                expect.objectContaining({
                  kind: 'add',
                  text: 'line 1',
                  newLineNumber: 1,
                }),
              ]),
            }),
          ]),
        },
      },
    });
  });
});

describe('readNcpSessionPreferredThinking', () => {
  it('normalizes persisted thinking metadata for UI hydration', () => {
    const thinking = readNcpSessionPreferredThinking(
      createSummary({
        metadata: {
          preferred_thinking: 'HIGH'
        }
      })
    );

    expect(thinking).toBe('high');
  });
});
