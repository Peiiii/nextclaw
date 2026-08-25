import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrivacySettingsPage } from '@/features/settings/pages/privacy-settings-page';

const mocks = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock('@/shared/hooks/use-config', () => ({
  useConfig: () => ({
    data: { productAnalytics: { schemaVersion: 2, enabled: true, audience: 'external' } },
    isLoading: false
  }),
  useProductAnalyticsStatus: () => ({
    data: {
      lastAttemptAt: '2026-08-25T12:00:00.000Z',
      lastSuccessAt: '2026-08-25T12:00:01.000Z',
      lastError: null,
      pendingReceiptCount: 0
    },
    isLoading: false
  }),
  useUpdateProductAnalytics: () => ({
    isPending: false,
    mutate: mocks.mutate
  })
}));

describe('PrivacySettingsPage', () => {
  beforeEach(() => mocks.mutate.mockClear());

  it('shows anonymous reporting enabled by default and saves opt-out and test audience', () => {
    render(<PrivacySettingsPage />);

    const shareSwitch = screen.getByRole('switch', { name: 'Send anonymous usage analytics' });
    expect(shareSwitch.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(shareSwitch);
    expect(mocks.mutate).toHaveBeenCalledWith({ data: { enabled: false } });

    fireEvent.click(screen.getByRole('combobox', { name: 'Analytics audience' }));
    fireEvent.click(screen.getByRole('option', { name: 'QA testing' }));
    expect(mocks.mutate).toHaveBeenCalledWith({ data: { audience: 'qa' } });
  });
});
