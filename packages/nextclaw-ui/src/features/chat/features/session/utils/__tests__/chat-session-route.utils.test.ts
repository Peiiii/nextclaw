import { describe, expect, it } from 'vitest';
import {
  CHAT_DRAFT_SESSION_PATH,
  buildSessionPanelUrl,
  parseSessionKeyFromPanelUrl,
  encodeSessionRouteId,
  buildSessionPath,
  parseSessionKeyFromRoute,
} from '@/features/chat/features/session/utils/chat-session-route.utils';

describe('chat session route utils', () => {
  it.each(['ncp-mu2x4zdy-9wzl0otb', 'agent:main:会话/一 %2F', 'sid_literal', 'draft'])(
    'round-trips resource and browser links for %s', (id) => {
      expect(buildSessionPanelUrl(id)).toBe(`nextclaw://sessions/${encodeURIComponent(id)}`);
      expect(parseSessionKeyFromPanelUrl(buildSessionPanelUrl(id))).toBe(id);
      expect(parseSessionKeyFromRoute(buildSessionPath(id).slice('/chat/'.length))).toBe(id);
      expect(parseSessionKeyFromPanelUrl(`nextclaw://chat-session/${encodeSessionRouteId(id)}`)).toBe(id);
    },
  );
  it('keeps ordinary IDs readable in the address bar', () => {
    expect(buildSessionPath('ncp-mu2x4zdy-9wzl0otb')).toBe('/chat/ncp-mu2x4zdy-9wzl0otb');
  });
  it.each(['sessions', 'chat-session', 'objects/chat-session', 'objects/chat-sessions'])(
    'recovers already delivered %s links', (namespace) => {
      expect(parseSessionKeyFromPanelUrl(`nextclaw://${namespace}/ncp-mu2x4zdy-9wzl0otb`)).toBe('ncp-mu2x4zdy-9wzl0otb');
    },
  );
  it.each(['nextclaw://sessions/', 'nextclaw://sessions/a/b', 'nextclaw://sessions/%ZZ',
    'nextclaw://sessions/%20', 'nextclaw://chat-session/sid_%%%','nextclaw://sessions/a?other=b',
    'https://sessions/a', 'nextclaw://user@sessions/a', 'nextclaw://objects/project/a'])(
    'rejects malformed or unrelated session links: %s', (uri) => {
      expect(parseSessionKeyFromPanelUrl(uri)).toBeNull();
    },
  );
  it('keeps the draft route separate from real session keys', () => {
    expect(CHAT_DRAFT_SESSION_PATH).toBe('/chat/draft');
    expect(parseSessionKeyFromRoute('draft')).toBeNull();
    expect(parseSessionKeyFromRoute(buildSessionPath('draft').slice('/chat/'.length))).toBe('draft');
  });
});
