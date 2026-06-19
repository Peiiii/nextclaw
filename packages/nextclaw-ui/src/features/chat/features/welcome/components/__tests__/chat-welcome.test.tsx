import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatWelcome } from '@/features/chat/features/welcome/components/chat-welcome';

vi.mock(
  '@/features/chat/features/session/components/session-header/chat-session-project-dialog',
  () => ({
    ChatSessionProjectDialog: () => null,
  }),
);

const sessionTypeOptions = [
  { value: 'native', label: 'Native', icon: null, ready: true },
  { value: 'codex', label: 'Codex', icon: null, ready: true },
];

function renderWelcome(
  overrides: Partial<Parameters<typeof ChatWelcome>[0]> = {},
) {
  return render(
    <ChatWelcome
      agents={[
        { id: 'main', displayName: 'Main' },
        { id: 'engineer', displayName: 'Engineer' },
      ]}
      projectOptions={[]}
      selectedAgentId="main"
      selectedSessionType="native"
      sessionTypeOptions={sessionTypeOptions}
      onSelectAgent={vi.fn()}
      onSelectPrompt={vi.fn()}
      onSelectSessionType={vi.fn()}
      {...overrides}
    />,
  );
}

describe('ChatWelcome', () => {
  it('renders a lightweight draft agent select and allows switching', () => {
    const onSelectAgent = vi.fn();

    renderWelcome({ onSelectAgent });

    const trigger = screen.getByRole('combobox', { name: 'Draft agent' });
    expect(screen.getByText('Main')).toBeTruthy();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.click(screen.getByText('Engineer'));

    expect(onSelectAgent).toHaveBeenCalledWith('engineer');
    expect(screen.queryByText('Current Agent:')).toBeNull();
  });

  it('uses an adaptive capability grid for narrow docked layouts', () => {
    renderWelcome({ agents: [{ id: 'main', displayName: 'Main' }] });

    expect(
      screen.getByRole('button', { name: /Smart Conversations/ }).parentElement
        ?.className,
    ).toContain('auto-fit');
  });

  it('fills the composer with a prompt suggestion when clicking a capability card', () => {
    const onSelectPrompt = vi.fn();

    renderWelcome({ onSelectPrompt });

    fireEvent.click(screen.getByRole('button', { name: /Smart Conversations/ }));

    expect(onSelectPrompt).toHaveBeenCalledWith(
      expect.stringContaining('next three concrete things'),
    );
  });

  it('lets users switch the welcome session type', () => {
    const onSelectSessionType = vi.fn();

    renderWelcome({ onSelectSessionType });

    fireEvent.click(screen.getByRole('button', { name: 'Choose session type' }));
    fireEvent.click(screen.getByText('Codex'));

    expect(onSelectSessionType).toHaveBeenCalledWith('codex');
  });

  it('shows recent projects in a scrollable menu with a fixed folder action', async () => {
    const onSelectProjectRoot = vi.fn();

    renderWelcome({
      defaultProjectRoot: '/Users/demo/.nextclaw/workspace',
      onSelectProjectRoot,
      projectOptions: [
        {
          projectRoot: '/tmp/project-alpha',
          projectName: 'project-alpha',
          sessionCount: 3,
        },
      ],
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Choose working directory' }),
    );
    expect(screen.getByText('Recent projects')).toBeTruthy();
    expect(screen.getByText('/tmp/project-alpha')).toBeTruthy();
    expect(screen.getByText('Open folder')).toBeTruthy();
    expect(screen.getByText('/tmp/project-alpha').closest('.overflow-y-auto'))
      .toBeTruthy();

    fireEvent.click(screen.getByText('project-alpha'));

    expect(onSelectProjectRoot).toHaveBeenCalledWith('/tmp/project-alpha');
    await waitFor(() => {
      expect(screen.queryByText('Recent projects')).toBeNull();
    });
  });
});
