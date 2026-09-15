import { describe, expect, it } from 'vitest';
import type { NcpSessionSummaryView } from '@/shared/lib/api';
import { resolveChatWelcomeContinuation } from '@/features/chat/features/welcome/utils/chat-welcome-continuation.utils';

const summary = (overrides: Partial<NcpSessionSummaryView> = {}): NcpSessionSummaryView => ({
  sessionId: 'original', agentId: 'main', messageCount: 2,
  updatedAt: '2026-09-16T10:00:00Z',
  metadata: { label: 'Project plan', project_root: '/project' },
  ...overrides,
});
const resolve = (sessions: NcpSessionSummaryView[], projectRoot = '/project') =>
  resolveChatWelcomeContinuation({ sessions, projectRoot, defaultProjectRoot: '/default', agentId: 'main' });

describe('resolveChatWelcomeContinuation', () => {
  it('selects by message activity without changing source ordering', () => {
    const sessions = [summary({ sessionId: 'old', lastMessageAt: '2026-09-10T10:00:00Z' }), summary()];
    expect(resolve(sessions)?.sessionKey).toBe('original');
    expect(sessions[0].sessionId).toBe('old');
  });

  it('excludes other agents, projects, empty, untitled and child sessions', () => {
    expect(resolve([
      summary({ agentId: 'other' }), summary({ messageCount: 0 }),
      summary({ metadata: { project_root: '/other', label: 'Other' } }),
      summary({ metadata: { project_root: '/project' } }),
      summary({ metadata: { project_root: '/project', label: 'Child', parentSessionId: 'parent' } }),
    ])).toBeNull();
  });

  it('uses the default workspace for old sessions without project metadata', () => {
    const sessions = [summary({ metadata: { label: 'Previous discussion' } })];
    expect(resolve(sessions, '/default')?.title).toBe('Previous discussion');
    expect(resolve(sessions)).toBeNull();
  });

  it('respects a working directory when project metadata is absent', () => {
    expect(resolve([summary({ metadata: { label: 'Working directory' }, workingDir: '/elsewhere' })])).toBeNull();
    expect(resolve([])).toBeNull();
  });
});
