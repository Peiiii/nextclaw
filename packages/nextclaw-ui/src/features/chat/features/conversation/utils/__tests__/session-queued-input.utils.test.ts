import { describe, expect, it } from 'vitest';
import type { UiNcpSessionQueuedInputView } from '@nextclaw/client-sdk';

import {
  buildSessionQueuedInputComposerSnapshot,
  buildSessionQueuedInputPresentation,
} from '@/features/chat/features/conversation/utils/session-queued-input.utils';

describe('session queued input utils', () => {
  it('restores text, inline skills, and attachments from the backend message', () => {
    const input: UiNcpSessionQueuedInputView = {
      id: 'queued-1',
      sessionId: 'session-1',
      enqueuedAt: '2026-07-22T10:00:00.000Z',
      metadata: {
        requested_skill_refs: ['project:review'],
        ui_inline_tokens: [{
          kind: 'skill',
          key: 'project:review',
          label: 'Review',
          rawText: '$review',
        }],
      },
      message: {
        id: 'message-1',
        sessionId: 'session-1',
        role: 'user',
        status: 'final',
        timestamp: '2026-07-22T10:00:00.000Z',
        parts: [
          { type: 'text', text: 'please $review ' },
          {
            type: 'file',
            name: 'spec.md',
            mimeType: 'text/markdown',
            sizeBytes: 12,
            assetUri: 'asset://spec',
          },
        ],
      },
    };

    const snapshot = buildSessionQueuedInputComposerSnapshot(input, [
      { ref: 'project:review', name: 'Code Review' },
    ]);

    expect(snapshot.text).toBe('please  ');
    expect(snapshot.nodes).toMatchObject([
      { type: 'text', text: 'please ' },
      { type: 'token', tokenKind: 'skill', tokenKey: 'project:review', label: 'Review' },
      { type: 'text', text: ' ' },
      { type: 'token', tokenKind: 'file', label: 'spec.md' },
    ]);
    expect(snapshot.selectedSkills).toEqual(['project:review']);
    expect(snapshot.skillRecords).toEqual([{ ref: 'project:review', name: 'Code Review' }]);
    expect(snapshot.attachments).toMatchObject([{
      name: 'spec.md',
      mimeType: 'text/markdown',
      assetUri: 'asset://spec',
    }]);
    expect(buildSessionQueuedInputPresentation(input)).toEqual({
      attachments: [{
        mimeType: 'text/markdown',
        name: 'spec.md',
      }],
      preview: 'please',
    });
  });

  it('keeps image content available to the compact queue presentation', () => {
    const input: UiNcpSessionQueuedInputView = {
      id: 'queued-image',
      sessionId: 'session-1',
      enqueuedAt: '2026-07-22T10:00:00.000Z',
      metadata: {},
      message: {
        id: 'message-image',
        sessionId: 'session-1',
        role: 'user',
        status: 'final',
        timestamp: '2026-07-22T10:00:00.000Z',
        parts: [
          {
            type: 'file',
            name: 'inline.png',
            mimeType: 'image/png',
            contentBase64: 'aW1hZ2U=',
          },
          {
            type: 'file',
            name: 'stored.png',
            mimeType: 'image/png',
            assetUri: 'asset://store/stored.png',
          },
        ],
      },
    };

    const presentation = buildSessionQueuedInputPresentation(input);

    expect(presentation.preview).toBe('');
    expect(presentation.attachments[0]).toEqual({
      mimeType: 'image/png',
      name: 'inline.png',
      previewUrl: 'data:image/png;base64,aW1hZ2U=',
    });
    expect(presentation.attachments[1]).toMatchObject({
      mimeType: 'image/png',
      name: 'stored.png',
      previewUrl: expect.stringContaining('/api/ncp/assets/content?uri=asset%3A%2F%2Fstore%2Fstored.png'),
    });
  });
});
