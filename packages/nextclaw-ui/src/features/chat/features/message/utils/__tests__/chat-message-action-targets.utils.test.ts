import { describe, expect, it } from 'vitest';
import type { NcpMessage } from '@nextclaw/ncp';

import { resolveChatMessageActionTargets } from '@/features/chat/features/message/utils/chat-message-action-targets.utils';

function message(id: string, role: NcpMessage['role']): NcpMessage {
  return {
    id,
    sessionId: 'session-1',
    role,
    status: 'final',
    timestamp: '2026-08-08T10:00:00.000Z',
    parts: [{ type: 'text', text: id }],
  };
}

describe('resolveChatMessageActionTargets', () => {
  it('edits only the latest visible user message', () => {
    expect(resolveChatMessageActionTargets({
      canContinue: false,
      isBusy: false,
      messages: [
        message('user-1', 'user'),
        message('assistant-1', 'assistant'),
        message('user-2', 'user'),
        message('assistant-2', 'assistant'),
      ],
    })).toEqual({
      continuationAssistantMessageId: null,
      editableUserMessageId: 'user-2',
    });
  });

  it('places continuation on the last partial assistant message', () => {
    expect(resolveChatMessageActionTargets({
      canContinue: true,
      isBusy: false,
      messages: [message('user-1', 'user'), message('assistant-1', 'assistant')],
    })).toEqual({
      continuationAssistantMessageId: 'assistant-1',
      editableUserMessageId: 'user-1',
    });
  });

  it('uses only the composer continuation entry when no assistant reply exists', () => {
    expect(resolveChatMessageActionTargets({
      canContinue: true,
      isBusy: false,
      messages: [message('user-1', 'user')],
    })).toEqual({
      continuationAssistantMessageId: null,
      editableUserMessageId: 'user-1',
    });
  });

  it('hides edit entirely while a run is active', () => {
    expect(resolveChatMessageActionTargets({
      canContinue: false,
      isBusy: true,
      messages: [message('user-1', 'user'), message('assistant-1', 'assistant')],
    }).editableUserMessageId).toBeNull();
  });
});
