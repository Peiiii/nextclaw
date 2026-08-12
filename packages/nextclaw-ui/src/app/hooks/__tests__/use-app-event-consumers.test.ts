import type { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { invalidateChangedServerPath } from '@/app/hooks/use-app-event-consumers';

describe('server path realtime invalidation', () => {
  it('invalidates only the browse query for the changed directory', () => {
    const invalidateQueries = vi.fn();
    invalidateChangedServerPath(
      { invalidateQueries } as unknown as QueryClient,
      '/Users/peiwang/Projects/nextbot/src',
    );

    const request = invalidateQueries.mock.calls[0]?.[0] as {
      predicate: (query: { queryKey: readonly unknown[] }) => boolean;
    };
    expect(request.predicate({ queryKey: ['server-path-browse', '/Users/peiwang/Projects/nextbot/src', '', true] })).toBe(true);
    expect(request.predicate({ queryKey: ['server-path-browse', '/Users/peiwang/Projects/nextbot', '', true] })).toBe(false);
    expect(request.predicate({ queryKey: ['server-path-read', '/Users/peiwang/Projects/nextbot/src', ''] })).toBe(false);
  });
});
