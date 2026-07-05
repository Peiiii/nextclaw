import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatSessionHeaderActions } from '@/features/chat/features/session/components/session-header/chat-session-header-actions';

const mocks = vi.hoisted(() => ({
  updateSessionProject: vi.fn(),
  onDeleteSession: vi.fn(),
  onOpenChildSessions: vi.fn(),
  onOpenSessionCronJobs: vi.fn(),
}));

vi.mock('@/features/chat/features/session/hooks/use-chat-session-project', () => ({
  useChatSessionProject: () => mocks.updateSessionProject,
}));

vi.mock('@/features/chat/features/session/components/session-header/chat-session-project-dialog', () => ({
  ChatSessionProjectDialog: () => null,
}));

describe('ChatSessionHeaderActions', () => {
  beforeEach(() => {
    mocks.updateSessionProject.mockReset();
    mocks.onDeleteSession.mockReset();
    mocks.onOpenChildSessions.mockReset();
    mocks.onOpenSessionCronJobs.mockReset();
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
    expect(screen.getByText('View Metadata')).toBeTruthy();
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
    expect(screen.getByText('View Metadata')).toBeTruthy();
  });

  it('opens the session metadata dialog from the more-actions menu', async () => {
    const user = userEvent.setup();

    render(
      <ChatSessionHeaderActions
        sessionKey="session-codex"
        canDeleteSession
        isDeletePending={false}
        projectRoot={null}
        metadata={{
          codex_thread_id: 'thread-123',
          runtime: 'codex',
        }}
        onDeleteSession={mocks.onDeleteSession}
      />
    );

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('button', { name: 'View Metadata' }));

    expect(screen.getByRole('dialog', { name: 'Session Metadata' })).toBeTruthy();
    const metadataBlock = screen.getByText(/codex_thread_id/);
    expect(metadataBlock.className).toContain('bg-muted/60');
    expect(metadataBlock.className).toContain('text-foreground');
    expect(screen.getByText(/thread-123/)).toBeTruthy();
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

  it('uses a shared spaced action group for child, cron, and menu buttons', () => {
    render(
      <ChatSessionHeaderActions
        sessionKey="session-actions"
        canDeleteSession
        isDeletePending={false}
        projectRoot={null}
        childSessionCount={1}
        sessionCronJobCount={1}
        onOpenChildSessions={mocks.onOpenChildSessions}
        onOpenSessionCronJobs={mocks.onOpenSessionCronJobs}
        onDeleteSession={mocks.onDeleteSession}
      />
    );

    const actionGroup = screen.getByRole('button', { name: 'More actions' }).parentElement;

    expect(actionGroup?.className).toContain('gap-1.5');
    expect(screen.getByRole('button', { name: 'View child sessions' }).className).toContain('h-7');
    expect(screen.getByRole('button', { name: 'View session cron jobs' }).className).toContain('w-7');
  });
});
