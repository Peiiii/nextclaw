import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ExtensionsConfigPage } from '@/features/extensions/pages/extensions-config-page';

vi.mock('@/features/extensions/hooks/use-extensions', () => ({
  useExtensions: () => ({
    data: {
      extensions: [{
        id: 'world-extension',
        name: 'World',
        version: '1.2.0',
        state: 'running',
        leaseCount: 1,
        observations: { context: true, events: true },
        channels: [{ id: 'world', name: 'World channel' }],
      }],
      counts: { total: 1, running: 1, withObservations: 1, withChannels: 1 },
    },
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

it('shows the global Extension entry with runtime and capability information', () => {
  render(<ExtensionsConfigPage />);

  expect(screen.getByText('Extension Management')).toBeTruthy();
  expect(screen.getByText('World')).toBeTruthy();
  expect(screen.getByText('Continuous-attention capabilities')).toBeTruthy();
  expect(screen.getByText('State · Events')).toBeTruthy();
  expect(screen.getByText('World channel')).toBeTruthy();
});
