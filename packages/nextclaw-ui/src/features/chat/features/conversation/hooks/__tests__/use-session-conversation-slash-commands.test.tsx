import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { compactNcpSessionContext } from '@/shared/lib/api';
import { useSessionConversationSlashCommands } from '@/features/chat/features/conversation/hooks/use-session-conversation-slash-commands';

const mocks = vi.hoisted(() => ({
  compactNcpSessionContext: vi.fn(),
  openSideChatDraft: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/shared/lib/api', () => ({
  compactNcpSessionContext: mocks.compactNcpSessionContext,
}));

vi.mock('@/features/chat/components/providers/chat-presenter.provider', () => ({
  usePresenter: () => ({
    chatThreadManager: { openSideChatDraft: mocks.openSideChatDraft },
  }),
}));

describe('useSessionConversationSlashCommands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.compactNcpSessionContext.mockResolvedValue({
      compacted: true,
      sessionId: 'session-1',
    });
  });

  it('exposes the runtime compaction command for the selected session', async () => {
    const { result } = renderHook(() => useSessionConversationSlashCommands({
      language: 'en',
      selectedSessionKey: ' session-1 ',
    }));
    const command = result.current.find((entry) => entry.key === 'compact-context');

    act(() => command?.onSelect());

    await waitFor(() => expect(compactNcpSessionContext).toHaveBeenCalledWith('session-1'));
    expect(toast.success).toHaveBeenCalledOnce();
  });

  it('reports runtime errors and suppresses duplicate in-flight requests', async () => {
    let rejectRequest!: (error: Error) => void;
    mocks.compactNcpSessionContext.mockReturnValue(new Promise((_resolve, reject) => {
      rejectRequest = reject;
    }));
    const { result } = renderHook(() => useSessionConversationSlashCommands({
      language: 'en',
      selectedSessionKey: 'session-1',
    }));
    const command = result.current.find((entry) => entry.key === 'compact-context');

    act(() => {
      command?.onSelect();
      command?.onSelect();
    });
    expect(compactNcpSessionContext).toHaveBeenCalledOnce();
    rejectRequest(new Error('session is busy'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('session is busy'),
    ));
  });

  it('does not expose session commands before a session exists', () => {
    const { result } = renderHook(() => useSessionConversationSlashCommands({
      language: 'en',
      selectedSessionKey: null,
    }));

    expect(result.current).toEqual([]);
  });
});
