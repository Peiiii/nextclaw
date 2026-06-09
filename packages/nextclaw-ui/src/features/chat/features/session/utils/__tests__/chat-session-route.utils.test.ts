import { describe, expect, it } from 'vitest';
import {
  CHAT_DRAFT_SESSION_PATH,
  buildSessionPath,
  parseSessionKeyFromRoute,
} from '@/features/chat/features/session/utils/chat-session-route.utils';

describe('chat session route utils', () => {
  it('keeps the draft route separate from real session keys', () => {
    expect(CHAT_DRAFT_SESSION_PATH).toBe('/chat/draft');
    expect(parseSessionKeyFromRoute('draft')).toBeNull();
    expect(parseSessionKeyFromRoute(buildSessionPath('draft').slice('/chat/'.length))).toBe('draft');
  });
});
