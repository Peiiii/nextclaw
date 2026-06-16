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
  { value: 'native', label: 'Native', ready: true },
  { value: 'codex', label: 'Codex', ready: true },
];

function renderWelcome(
  overrides: Partial<Parameters<typeof ChatWelcome>[0]> = {},
) {
  return render(
    <ChatWelcome
      onCreateSession={vi.fn()}
      agents={[
        { id: 'main', displayName: 'Main' },
        { id: 'engineer', displayName: 'Engineer' },
      ]}
      projectOptions={[]}
      selectedAgentId="main"
      selectedSessionType="native"
      sessionTypeOptions={sessionTypeOptions}
      onSelectAgent={vi.fn()}
      onSelectSessionType={vi.fn()}
      {...overrides}
    />,
  );
}

describe('ChatWelcome', () => {
  it('renders a lightweight draft agent select and allows switching', () => {
    const onCreateSession = vi.fn();
    const onSelectAgent = vi.fn();

    renderWelcome({ onCreateSession, onSelectAgent });

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
          projectRoot: '/Users/demo/.nextclaw/workspace',
          projectName: 'workspace',
          sessionCount: 0,
          isDefault: true,
        },
        {
          projectRoot: '/tmp/project-alpha',
          projectName: 'project-alpha',
          sessionCount: 3,
          isDefault: false,
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
