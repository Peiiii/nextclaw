import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IconActionButton } from '@/shared/components/ui/actions/icon-action-button';

describe('IconActionButton', () => {
  it('applies compact size and strong tone classes for nested hover surfaces', () => {
    render(
      <IconActionButton
        size="sm"
        tone="strong"
        icon={<span data-testid="icon" />}
        label="Pin"
      />,
    );

    const button = screen.getByRole('button', { name: 'Pin' });
    expect(button.className).toContain('h-6');
    expect(button.className).toContain('w-6');
    expect(button.className).toContain('p-1');
    expect(button.className).toContain('hover:bg-black/10');
  });

  it('defaults to medium size and soft accent hover', () => {
    render(
      <IconActionButton
        icon={<span data-testid="icon" />}
        label="More"
      />,
    );

    const button = screen.getByRole('button', { name: 'More' });
    expect(button.className).toContain('h-7');
    expect(button.className).toContain('w-7');
    expect(button.className).toContain('hover:bg-accent');
  });

  it('ignores restored pointer focus while preserving keyboard tooltip focus', () => {
    render(
      <IconActionButton
        icon={<span data-testid="icon" />}
        label="Session Type"
      />,
    );

    const button = screen.getByRole('button', { name: 'Session Type' });
    const matches = vi.spyOn(button, 'matches');

    matches.mockReturnValue(false);
    fireEvent.focus(button);
    expect(screen.queryByRole('tooltip')).toBeNull();

    fireEvent.blur(button);
    matches.mockReturnValue(true);
    fireEvent.focus(button);
    expect(screen.getByRole('tooltip').textContent).toBe('Session Type');
  });
});
