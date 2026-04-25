import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AgentAvatar } from './agent-avatar';

describe('AgentAvatar', () => {
  it('uses the configured image for the main agent before fallback', () => {
    render(
      <AgentAvatar
        agentId="main"
        displayName="Main"
        avatarUrl="https://example.com/main-avatar.png"
      />,
    );

    const avatar = screen.getByRole('img', { name: 'Main' });
    expect(avatar.getAttribute('src')).toBe('https://example.com/main-avatar.png');
    expect(avatar.querySelector('svg')).toBeNull();
  });

  it('uses the bot icon for the main agent fallback', () => {
    render(<AgentAvatar agentId="main" displayName="Main" />);

    const avatar = screen.getByLabelText('Main');
    expect(avatar.querySelector('svg')).toBeTruthy();
    expect(avatar.textContent).not.toContain('M');
  });

  it('keeps letter fallback avatars for specialist agents', () => {
    render(<AgentAvatar agentId="engineer" displayName="Engineer" />);

    expect(screen.getByLabelText('Engineer').textContent).toBe('E');
  });
});
