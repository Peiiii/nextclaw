import {
  adaptNcpMessageToUiMessage,
  adaptNcpSessionSummary,
  buildNcpSessionRunStatusByKey,
  readNcpSessionPreferredThinking
} from '@/components/chat/ncp/ncp-session-adapter';
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
          session_type: 'native'
        }
      })
    );

    expect(adapted).toMatchObject({
      key: 'ncp-session-1',
      label: 'NCP Planning Thread',
      preferredModel: 'openai/gpt-5',
      preferredThinking: 'medium',
      sessionType: 'native',
      sessionTypeMutable: false,
      messageCount: 3
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
        mimeType: 'image/png',
        data: 'ZmFrZS1pbWFnZQ=='
      },
      {
        type: 'text',
        text: ' after'
      }
    ]);
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

describe('buildNcpSessionRunStatusByKey', () => {
  it('marks the active local session as running before the server summary catches up', () => {
    const statuses = buildNcpSessionRunStatusByKey({
      summaries: [createSummary({ sessionId: 'ncp-session-1', status: 'idle' })],
      activeSessionId: 'ncp-session-1',
      isLocallyRunning: true
    });

    expect(statuses.get('ncp-session-1')).toBe('running');
  });

  it('keeps persisted running sessions marked as running', () => {
    const statuses = buildNcpSessionRunStatusByKey({
      summaries: [createSummary({ sessionId: 'ncp-session-2', status: 'running' })],
      activeSessionId: null,
      isLocallyRunning: false
    });

    expect(statuses.get('ncp-session-2')).toBe('running');
  });
});
