import { describe, expect, it } from 'vitest';
import type { SessionEntryView } from '@/shared/lib/api';
import {
  formatSessionListTime,
  sessionActivityPreviewText,
  sessionDisplayName,
  sessionMatchesQuery
} from './chat-session-display.utils';

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

  it('shows running activity before the previous reply preview', () => {
    expect(
      sessionActivityPreviewText(
        createSession({
          activityPreview: {
            state: 'running',
            statusText: '正在调用工具：shell',
            replyText: '之前的回复',
            timestamp: '2026-05-16T01:00:00.000Z'
          }
        })
      )
    ).toBe('正在调用工具：shell');
  });

  it('shows the final assistant reply after completion', () => {
    expect(
      sessionActivityPreviewText(
        createSession({
          activityPreview: {
            state: 'completed',
            statusText: '工具调用完成',
            replyText: '最终回复内容',
            timestamp: '2026-05-16T01:00:00.000Z'
          }
        })
      )
    ).toBe('最终回复内容');
  });

  it('formats today activity as time like WeChat session lists', () => {
    expect(
      formatSessionListTime(
        new Date(2026, 4, 16, 9, 5),
        'zh',
        new Date(2026, 4, 16, 12, 0)
      )
    ).toBe('09:05');
  });

  it('formats yesterday activity as yesterday like WeChat session lists', () => {
    expect(
      formatSessionListTime(
        new Date(2026, 4, 15, 23, 30),
        'zh',
        new Date(2026, 4, 16, 12, 0)
      )
    ).toBe('昨天');
  });

  it('formats recent activity within a week as weekday', () => {
    expect(
      formatSessionListTime(
        new Date(2026, 4, 12, 18, 30),
        'zh',
        new Date(2026, 4, 16, 12, 0)
      )
    ).toBe('星期二');
  });

  it('formats older activity as date and keeps year only across years', () => {
    expect(
      formatSessionListTime(
        new Date(2026, 4, 1, 18, 30),
        'zh',
        new Date(2026, 4, 16, 12, 0)
      )
    ).toBe('5月1日');
    expect(
      formatSessionListTime(
        new Date(2025, 11, 31, 18, 30),
        'zh',
        new Date(2026, 4, 16, 12, 0)
      )
    ).toBe('2025年12月31日');
  });
});
