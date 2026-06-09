import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatWelcome } from '../chat-welcome';

describe('ChatWelcome', () => {
  it('renders a lightweight draft agent select and allows switching', () => {
    const onCreateSession = vi.fn();
    const onSelectAgent = vi.fn();

    render(
      <ChatWelcome
        onCreateSession={onCreateSession}
        agents={[
          { id: 'main', displayName: 'Main' },
          { id: 'engineer', displayName: 'Engineer' }
        ]}
        selectedAgentId="main"
        onSelectAgent={onSelectAgent}
      />
    );

    const trigger = screen.getByRole('combobox', { name: 'Draft agent' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.click(screen.getByText('Engineer'));

    expect(onSelectAgent).toHaveBeenCalledWith('engineer');
    expect(screen.queryByText('Current Agent:')).toBeNull();
  });

  it('uses an adaptive capability grid for narrow docked layouts', () => {
    render(
      <ChatWelcome
        onCreateSession={vi.fn()}
        agents={[{ id: 'main', displayName: 'Main' }]}
        selectedAgentId="main"
        onSelectAgent={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Smart Conversations/ }).parentElement?.className).toContain(
      'auto-fit',
    );
  });
});
