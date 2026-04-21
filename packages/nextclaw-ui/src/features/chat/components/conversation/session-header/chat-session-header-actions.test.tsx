import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatSessionHeaderActions } from './chat-session-header-actions';

const mocks = vi.hoisted(() => ({
  updateSessionProject: vi.fn(),
  onDeleteSession: vi.fn(),
  onOpenChildSessions: vi.fn(),
}));

vi.mock('@/features/chat/hooks/use-chat-session-project', () => ({
  useChatSessionProject: () => mocks.updateSessionProject,
}));

vi.mock('./chat-session-project-dialog', () => ({
  ChatSessionProjectDialog: () => null,
}));

describe('ChatSessionHeaderActions', () => {
  beforeEach(() => {
    mocks.updateSessionProject.mockReset();
    mocks.onDeleteSession.mockReset();
    mocks.onOpenChildSessions.mockReset();
  });

  it('keeps only the set-project action in the more-actions menu when a project is already attached', async () => {
    const user = userEvent.setup();

    render(
      <ChatSessionHeaderActions
        sessionKey="session-1"
        canDeleteSession
        isDeletePending={false}
        projectRoot="/tmp/project-alpha"
        childSessionCount={0}
        onOpenChildSessions={mocks.onOpenChildSessions}
        onDeleteSession={mocks.onDeleteSession}
      />
    );

    await user.click(screen.getByRole('button', { name: 'More actions' }));

    expect(screen.getByText('Set Project Directory')).toBeTruthy();
    expect(screen.queryByText('Clear Project Directory')).toBeNull();
    expect(screen.getByText('Delete Session')).toBeTruthy();
  });

  it('keeps the set-project entry in the more-actions menu when no project is attached', async () => {
    const user = userEvent.setup();

    render(
      <ChatSessionHeaderActions
        sessionKey="draft-session"
        canDeleteSession={false}
        isDeletePending={false}
        projectRoot={null}
        childSessionCount={0}
        onOpenChildSessions={mocks.onOpenChildSessions}
        onDeleteSession={mocks.onDeleteSession}
      />
    );

    await user.click(screen.getByRole('button', { name: 'More actions' }));

    expect(screen.getByText('Set Project Directory')).toBeTruthy();
    expect(screen.queryByText('Clear Project Directory')).toBeNull();
  });

  it('shows a dedicated child-session entry button when the current session has child sessions', async () => {
    const user = userEvent.setup();

    render(
      <ChatSessionHeaderActions
        sessionKey="session-children"
        canDeleteSession
        isDeletePending={false}
        projectRoot={null}
        childSessionCount={2}
        onOpenChildSessions={mocks.onOpenChildSessions}
        onDeleteSession={mocks.onDeleteSession}
      />
    );

    await user.click(screen.getByRole('button', { name: 'View child sessions' }));

    expect(mocks.onOpenChildSessions).toHaveBeenCalledTimes(1);
  });
});
