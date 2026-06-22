import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatSessionProjectBadge } from '@/features/chat/features/session/components/session-header/chat-session-project-badge';
import { createPopoverAvailableHeightLimit } from '@/shared/components/ui/popover';

const mocks = vi.hoisted(() => ({
  updateSessionProject: vi.fn(),
}));

vi.mock('@/features/chat/features/session/hooks/use-chat-session-project', () => ({
  useChatSessionProject: () => mocks.updateSessionProject,
}));

vi.mock('@/features/chat/features/session/components/session-header/chat-session-project-dialog', () => ({
  ChatSessionProjectDialog: () => null,
}));

function renderProjectBadge() {
  return render(
    <ChatSessionProjectBadge
      sessionKey="session-1"
      projectName="project-alpha"
      projectRoot="/tmp/project-alpha"
      persistToServer
    />
  );
}

describe('ChatSessionProjectBadge', () => {
  beforeEach(() => {
    mocks.updateSessionProject.mockReset();
    mocks.updateSessionProject.mockResolvedValue(undefined);
  });

  it('shows project actions inside the badge popover', async () => {
    const user = userEvent.setup();

    renderProjectBadge();

    await user.click(screen.getByRole('button', { name: 'Set Project Directory' }));

    expect(screen.getAllByText('Set Project Directory').length).toBeGreaterThan(0);
    expect(screen.getByText('Clear Project Directory')).toBeTruthy();
    const projectRoot = screen.getByText('/tmp/project-alpha');
    expect(projectRoot).toBeTruthy();

    const boundedPopover = projectRoot.closest('[style*="max-height"]') as HTMLElement | null;
    expect(boundedPopover?.style.maxHeight).toBe(
      createPopoverAvailableHeightLimit('18rem')
    );
    expect(boundedPopover?.style.maxHeight).toContain('max(0px');
    expect(boundedPopover?.style.maxHeight).toContain('100vh');
    expect(boundedPopover?.style.maxHeight).toContain('2rem');
  });

  it('uses the neutral header tag styling instead of a highlighted accent color', () => {
    renderProjectBadge();

    const trigger = screen.getByRole('button', { name: 'Set Project Directory' });
    expect(trigger.className).toContain('border-border');
    expect(trigger.className).toContain('text-muted-foreground');
    expect(trigger.className).not.toContain('emerald');
  });

  it('clears the current project from the badge popover', async () => {
    const user = userEvent.setup();

    renderProjectBadge();

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
