// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import type { NcpAgentClientEndpoint, NcpMessage } from '@nextclaw/ncp';
import { useHydratedNcpAgent } from '@nextclaw/ncp-react';
import { describe, expect, it, vi } from 'vitest';

function message(id: string, text: string): NcpMessage {
  return {
    id,
    sessionId: 'session-1',
    role: 'user',
    status: 'final',
    timestamp: '2026-08-08T10:00:00.000Z',
    parts: [{ type: 'text', text }],
  };
}

describe('useHydratedNcpAgent history replacement', () => {
  it('replaces the current session history and running state in one manager update', async () => {
    let finishStream: (() => void) | null = null;
    const client = {
      abort: vi.fn(),
      send: vi.fn(),
      subscribe: vi.fn(() => () => undefined),
      stop: vi.fn(async () => finishStream?.()),
      stream: vi.fn(
        async () =>
          await new Promise<void>((resolve) => {
            finishStream = resolve;
          }),
      ),
    } as unknown as NcpAgentClientEndpoint;
    const original = message('user-original', 'original');
    const edited = message('user-edited', 'edited');
    const loadSeed = async () => ({ messages: [original], status: 'idle' as const });
    const { result, unmount } = renderHook(() =>
      useHydratedNcpAgent({
        client,
        loadSeed,
        sessionId: 'session-1',
      }),
    );
    await waitFor(() => expect(result.current.isHydrating).toBe(false));

    act(() => {
      result.current.replaceHistory({
        messages: [edited],
        status: 'running',
      });
    });

    expect(result.current.visibleMessages).toEqual([edited]);
    expect(result.current.isRunning).toBe(true);
    unmount();
  });
});
