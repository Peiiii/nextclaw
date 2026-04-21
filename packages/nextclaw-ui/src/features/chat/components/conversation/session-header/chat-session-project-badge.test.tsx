import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatSessionProjectBadge } from './chat-session-project-badge';

const mocks = vi.hoisted(() => ({
  updateSessionProject: vi.fn(),
}));

vi.mock('@/features/chat/hooks/use-chat-session-project', () => ({
  useChatSessionProject: () => mocks.updateSessionProject,
}));

vi.mock('./chat-session-project-dialog', () => ({
  ChatSessionProjectDialog: () => null,
}));

describe('ChatSessionProjectBadge', () => {
  beforeEach(() => {
    mocks.updateSessionProject.mockReset();
    mocks.updateSessionProject.mockResolvedValue(undefined);
  });

  it('shows project actions inside the badge popover', async () => {
    const user = userEvent.setup();

    render(
      <ChatSessionProjectBadge
        sessionKey="session-1"
        projectName="project-alpha"
        projectRoot="/tmp/project-alpha"
        persistToServer
      />
    );

    await user.click(screen.getByRole('button', { name: 'Set Project Directory' }));

    expect(screen.getAllByText('Set Project Directory').length).toBeGreaterThan(0);
    expect(screen.getByText('Clear Project Directory')).toBeTruthy();
    expect(screen.getByText('/tmp/project-alpha')).toBeTruthy();
  });

  it('uses the neutral header tag styling instead of a highlighted accent color', () => {
    render(
      <ChatSessionProjectBadge
        sessionKey="session-1"
        projectName="project-alpha"
        projectRoot="/tmp/project-alpha"
        persistToServer
      />
    );

    const trigger = screen.getByRole('button', { name: 'Set Project Directory' });
    expect(trigger.className).toContain('border-gray-200');
    expect(trigger.className).toContain('text-gray-600');
    expect(trigger.className).not.toContain('emerald');
  });

  it('clears the current project from the badge popover', async () => {
    const user = userEvent.setup();

    render(
      <ChatSessionProjectBadge
        sessionKey="session-1"
        projectName="project-alpha"
        projectRoot="/tmp/project-alpha"
        persistToServer
      />
    );

    await user.click(screen.getByRole('button', { name: 'Set Project Directory' }));
    await user.click(screen.getByText('Clear Project Directory'));

    await waitFor(() => {
      expect(mocks.updateSessionProject).toHaveBeenCalledWith({
        sessionKey: 'session-1',
        projectRoot: null,
        persistToServer: true,
      });
    });
  });
});
