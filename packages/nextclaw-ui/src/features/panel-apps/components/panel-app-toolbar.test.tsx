import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PanelAppToolbar } from './panel-app-toolbar';

describe('PanelAppToolbar', () => {
  it('shows the current panel app title in the detail header', async () => {
    const user = userEvent.setup();
    const onOpenApps = vi.fn();
    render(
      <PanelAppToolbar
        appTitle="墨爪助手"
        onOpenApps={onOpenApps}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText('墨爪助手')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Apps' }));

    expect(onOpenApps).toHaveBeenCalledTimes(1);
  });
});
