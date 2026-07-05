import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppearanceSettingsPage } from '@/features/settings/pages/appearance-settings-page';
import { useSideDockStore } from '@/features/side-dock';

describe('AppearanceSettingsPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSideDockStore.getState().setVisible(true);
    useSideDockStore.getState().setPinnedItems([]);
  });

  it('reopens the SideDock from the appearance settings switch', () => {
    useSideDockStore.getState().setVisible(false);

    render(<AppearanceSettingsPage />);

    const visibilitySwitch = screen.getByRole('switch', { name: 'Show SideDock' });
    expect(visibilitySwitch.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(visibilitySwitch);

    expect(useSideDockStore.getState().isVisible).toBe(true);
  });
});
