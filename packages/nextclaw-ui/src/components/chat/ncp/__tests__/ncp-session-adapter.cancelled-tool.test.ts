import { describe, expect, it } from 'vitest';
import { adaptChatMessage } from '@/components/chat/adapters/chat-message.adapter';
import { adaptNcpMessageToUiMessage } from '../ncp-session-adapter';

const texts = {
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
};

describe('adaptNcpMessageToUiMessage cancelled tools', () => {
  it('renders cancelled tool invocations as cancelled cards', () => {
    const uiMessage = adaptNcpMessageToUiMessage({
      id: 'ncp-message-tool-cancelled-1',
      sessionId: 'ncp-session-1',
      role: 'assistant',
      status: 'final',
      timestamp: '2026-04-01T00:00:00.000Z',
      parts: [
        {
          type: 'tool-invocation',
          toolCallId: 'tool-cancelled-1',
          toolName: 'write_file',
          state: 'cancelled',
          args: JSON.stringify({
            path: 'src/app.ts',
            content: 'hello',
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
        texts,
      },
    );

    expect(adapted.parts[0]).toMatchObject({
      type: 'tool-card',
      card: {
        toolName: 'write_file',
        statusTone: 'cancelled',
        statusLabel: 'Cancelled',
        titleLabel: 'Tool Result',
      },
    });
  });
});
