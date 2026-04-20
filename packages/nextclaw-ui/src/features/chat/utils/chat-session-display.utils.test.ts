import { describe, expect, it } from 'vitest';
import type { SessionEntryView } from '@/api/types';
import { sessionDisplayName, sessionMatchesQuery } from './chat-session-display.utils';

function createSession(overrides: Partial<SessionEntryView> = {}): SessionEntryView {
  return {
    key: 'agent:demo:feishu:default',
    createdAt: '2026-03-31T10:00:00.000Z',
    updatedAt: '2026-03-31T10:00:00.000Z',
    sessionType: 'native',
    sessionTypeMutable: false,
    isChildSession: false,
    messageCount: 3,
    ...overrides
  };
}

describe('chat-session-display', () => {
  it('prefers the trimmed label as the display name', () => {
    expect(sessionDisplayName(createSession({ label: '  Important customer  ' }))).toBe('Important customer');
  });

  it('matches the search query against the session key', () => {
    expect(sessionMatchesQuery(createSession(), 'feishu')).toBe(true);
  });

  it('matches the search query against the visible session label', () => {
    expect(sessionMatchesQuery(createSession({ label: 'VIP Alpha Thread' }), 'alpha')).toBe(true);
  });

  it('matches the search query against the project name and path', () => {
    expect(
      sessionMatchesQuery(
        createSession({
          projectRoot: '/Users/demo/workspace/project-apollo',
          projectName: 'project-apollo'
        }),
        'apollo'
      )
    ).toBe(true);
    expect(
      sessionMatchesQuery(
        createSession({
          projectRoot: '/Users/demo/workspace/project-apollo',
          projectName: 'project-apollo'
        }),
        'workspace/project'
      )
    ).toBe(true);
  });

  it('treats an empty query as a match', () => {
    expect(sessionMatchesQuery(createSession({ label: 'Anything' }), '   ')).toBe(true);
  });
});
