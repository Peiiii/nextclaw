import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { ChatSessionTokenUsage } from '@/features/chat/features/workspace/components/overview/chat-session-token-usage';

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  query: {
    data: undefined as unknown,
    isLoading: false,
    isError: false,
  },
}));

vi.mock('@/features/chat/features/ncp/hooks/use-ncp-session-queries', () => ({
  useNcpSessionTokenUsage: () => ({
    ...mocks.query,
    refetch: mocks.refetch,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.refetch.mockResolvedValue(undefined);
  mocks.query.data = {
    sessionId: 'parent-1',
    totals: {
      inputTokens: 1_250,
      outputTokens: 240,
      cachedInputTokens: 500,
      totalTokens: 1_490,
      cacheHitRate: 0.4,
    },
    models: [
      {
        model: 'openai/gpt-5',
        inputTokens: 1_000,
        outputTokens: 200,
        cachedInputTokens: 400,
        totalTokens: 1_200,
        cacheHitRate: 0.4,
        runCount: 2,
        modelCallCount: 3,
        reportedModelCallCount: 3,
        status: 'reported',
      },
      {
        model: 'anthropic/claude-sonnet-4',
        inputTokens: 250,
        outputTokens: 40,
        cachedInputTokens: 100,
        totalTokens: 290,
        cacheHitRate: 0.4,
        runCount: 1,
        modelCallCount: 2,
        reportedModelCallCount: 1,
        status: 'partial',
      },
    ],
    runCount: 3,
    modelCallCount: 5,
    reportedModelCallCount: 4,
    status: 'partial',
  };
  mocks.query.isLoading = false;
  mocks.query.isError = false;
});

it('shows totals, model calls, cache read ratio, and usage grouped by model', () => {
  render(<ChatSessionTokenUsage sessionKey="parent-1" />);

  expect(screen.getByText('Token usage')).toBeTruthy();
  expect(screen.getByText('1,490')).toBeTruthy();
  expect(screen.getAllByText('40%').length).toBeGreaterThan(0);
  expect(screen.getByText('Model calls')).toBeTruthy();
  expect(screen.getByText('Reported calls')).toBeTruthy();
  expect(screen.getByText('2 agent rounds · 3 model calls · Cache read ratio: 40%')).toBeTruthy();
  expect(screen.getByText('openai/gpt-5')).toBeTruthy();
  expect(screen.getByText('anthropic/claude-sonnet-4')).toBeTruthy();
  expect(screen.getAllByText('Partial usage')).toHaveLength(2);
});

it('lets users retry after token usage fails to load', async () => {
  const user = userEvent.setup();
  mocks.query.data = undefined;
  mocks.query.isError = true;

  render(<ChatSessionTokenUsage sessionKey="parent-1" />);

  expect(screen.getByRole('alert').textContent).toContain('Couldn’t load token usage.');
  await user.click(screen.getByRole('button', { name: 'Retry' }));
  expect(mocks.refetch).toHaveBeenCalledTimes(1);
});
