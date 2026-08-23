import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { ChatSessionContinuousAttention } from '@/features/chat/features/workspace/components/overview/chat-session-continuous-attention';

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
}));

vi.mock('@/features/chat/features/ncp/hooks/use-ncp-session-queries', () => ({
  useNcpSessionObservations: () => ({
    data: {
      sessionId: 'session-1',
      bindings: [{
        id: 'binding-1',
        kind: 'context',
        extensionId: 'world-extension',
        title: 'World',
        description: 'Latest state',
        status: 'active',
        createdAt: '2026-08-23T08:00:00.000Z',
        lastReadAt: '2026-08-23T08:05:00.000Z',
        safeConfigPreview: 'project: nextclaw',
      }],
      subscriptions: [{
        id: 'subscription-1',
        kind: 'events',
        extensionId: 'world-extension',
        title: 'World events',
        status: 'paused',
        createdAt: '2026-08-23T08:01:00.000Z',
        pendingCount: 2,
      }],
      counts: { total: 2, context: 1, events: 1, needsAttention: 1 },
    },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useNcpObservationAction: () => ({
    isPending: false,
    variables: undefined,
    mutateAsync: mocks.mutateAsync,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mutateAsync.mockResolvedValue(undefined);
});

it('separates state and event relationships and manages the active relationship', async () => {
  const user = userEvent.setup();
  render(<ChatSessionContinuousAttention sessionKey="session-1" />);

  expect(screen.getByText('World')).toBeTruthy();
  expect(screen.getByText('Needs attention')).toBeTruthy();
  await user.click(screen.getByRole('tab', { name: /Events/ }));
  expect(screen.getByText('World events')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Resume' }));

  expect(mocks.mutateAsync).toHaveBeenCalledWith({
    kind: 'events',
    id: 'subscription-1',
    action: 'resume',
  });
});
