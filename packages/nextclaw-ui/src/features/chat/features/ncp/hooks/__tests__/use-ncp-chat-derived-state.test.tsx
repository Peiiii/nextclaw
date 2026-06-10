import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNcpChatSelectedSession } from '@/features/chat/features/ncp/hooks/use-ncp-chat-derived-state';
import { useChatQueryStore } from '@/features/chat/stores/ncp-chat-query.store';

describe('useNcpChatSelectedSession', () => {
  beforeEach(() => {
    useChatQueryStore.setState({ snapshot: {} });
  });

  it('keeps the empty sessions snapshot stable before the sessions query loads', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useNcpChatSelectedSession('missing-session'));

    expect(result.current).toBeNull();
    expect(errorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('The result of getSnapshot should be cached'),
    );
    errorSpy.mockRestore();
  });
});
