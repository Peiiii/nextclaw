import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PanelAppToolbar } from '@/features/panel-apps/components/panel-app-toolbar';

describe('PanelAppToolbar', () => {
  it('keeps placement in the overflow menu without adding a second back action', async () => {
    const user = userEvent.setup();
    const onToggleMainSidebar = vi.fn();
    render(
      <PanelAppToolbar
        appTitle="墨爪助手"
        mainSidebar={false}
        onRefresh={vi.fn()}
        onToggleMainSidebar={onToggleMainSidebar}
      />,
    );

    expect(screen.getByText('墨爪助手')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Apps' })).toBeNull();

    expect(screen.queryByRole('button', { name: 'Add to main sidebar' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'More panel app actions' }));
    const addButton = screen.getByRole('button', { name: 'Add to main sidebar' });
    expect(addButton.getAttribute('aria-pressed')).toBe('false');
    await user.click(addButton);

    expect(onToggleMainSidebar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Add to main sidebar' })).toBeNull();
  });
});
