import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrivacySettingsPage } from '@/features/settings/pages/privacy-settings-page';

const mocks = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock('@/shared/hooks/use-config', () => ({
  useConfig: () => ({
    data: { productAnalytics: { enabled: false, audience: 'external' } },
    isLoading: false
  }),
  useUpdateProductAnalytics: () => ({
    isPending: false,
    mutate: mocks.mutate
  })
}));

describe('PrivacySettingsPage', () => {
  beforeEach(() => mocks.mutate.mockClear());

  it('requires explicit opt-in and saves the selected test audience', () => {
    render(<PrivacySettingsPage />);

    const shareSwitch = screen.getByRole('switch', { name: 'Share product activity' });
    expect(shareSwitch.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(shareSwitch);
    expect(mocks.mutate).toHaveBeenCalledWith({ data: { enabled: true } });

    fireEvent.click(screen.getByRole('combobox', { name: 'Analytics audience' }));
    fireEvent.click(screen.getByRole('option', { name: 'QA testing' }));
    expect(mocks.mutate).toHaveBeenCalledWith({ data: { audience: 'qa' } });
  });
});
