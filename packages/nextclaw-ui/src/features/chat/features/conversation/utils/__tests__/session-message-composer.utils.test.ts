import { describe, expect, it } from 'vitest';

import { buildSessionMessageComposerSnapshot } from '@/features/chat/features/conversation/utils/session-message-composer.utils';

describe('buildSessionMessageComposerSnapshot', () => {
  it('round-trips text, attachment and skill-token state into the shared composer', () => {
    const snapshot = buildSessionMessageComposerSnapshot({
      attachmentIdPrefix: 'edit-user-1',
      availableSkills: [{ ref: 'skill://review', name: 'Review' }],
      message: {
        id: 'user-1',
        sessionId: 'session-1',
        role: 'user',
        status: 'final',
        timestamp: '2026-08-08T10:00:00.000Z',
        metadata: {
          ui_inline_tokens: [{
            kind: 'skill',
            key: 'skill://review',
            label: 'Review',
            rawText: '$Review',
          }],
        },
        parts: [
          { type: 'text', text: 'check $Review this' },
          { type: 'file', name: 'notes.txt', mimeType: 'text/plain', sizeBytes: 12 },
        ],
      },
    });

    expect(snapshot.text).toBe('check  this');
    expect(snapshot.selectedSkills).toEqual(['skill://review']);
    expect(snapshot.skillRecords).toEqual([{ ref: 'skill://review', name: 'Review' }]);
    expect(snapshot.attachments).toEqual([
      expect.objectContaining({ id: 'edit-user-1-1', name: 'notes.txt' }),
    ]);
    expect(snapshot.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'token', tokenKind: 'file' }),
    ]));
  });
});
