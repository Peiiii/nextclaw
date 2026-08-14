import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { ChatSessionChildSessions } from '@/features/chat/features/workspace/components/child-sessions/chat-session-child-sessions';
import type { ResolvedChildSessionTab } from '@/features/chat/features/ncp/hooks/use-ncp-child-session-tabs-view';

const mocks = vi.hoisted(() => ({
  openSideChatDraft: vi.fn(),
  selectChildSessionDetail: vi.fn(),
}));

vi.mock('@/features/chat/components/providers/chat-presenter.provider', () => ({
  usePresenter: () => ({ chatThreadManager: mocks }),
}));

beforeEach(() => vi.clearAllMocks());

function createChildSession(): ResolvedChildSessionTab {
  return {
    sessionKey: 'child-1',
    parentSessionKey: 'parent-1',
    title: 'Research branch',
    agentId: 'main',
    updatedAt: null,
    lastMessageAt: null,
    readAt: null,
    runStatus: undefined,
    sessionTypeLabel: 'Native',
    preferredModel: 'openai/gpt-5',
    projectName: 'nextbot',
    projectRoot: '/tmp/nextbot',
  };
}

it('opens a new child-session draft from the management page', async () => {
  const user = userEvent.setup();
  render(<ChatSessionChildSessions childSessionTabs={[]} sessionKey="parent-1" />);

  expect(screen.getByText('No child sessions yet.')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'New child session' }));
  expect(mocks.openSideChatDraft).toHaveBeenCalledWith('parent-1');
});

it('keeps existing child sessions selectable beside the create action', async () => {
  const user = userEvent.setup();
  render(<ChatSessionChildSessions childSessionTabs={[createChildSession()]} sessionKey="parent-1" />);

  expect(screen.getByRole('button', { name: 'New child session' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: /Research branch/ }));
  expect(mocks.selectChildSessionDetail).toHaveBeenCalledWith('child-1');
});
