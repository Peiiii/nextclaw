import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionsConfig } from '@/features/chat/pages/sessions-config-page';
import type { NcpMessageView, NcpSessionMessagesView, NcpSessionsListView } from '@/api/types';
import { setLanguage } from '@/lib/i18n';

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  refetch: vi.fn(),
  updateMutate: vi.fn(),
  deleteMutate: vi.fn(),
  sessionsQuery: null as unknown as {
    data?: NcpSessionsListView;
    isLoading: boolean;
    isFetching: boolean;
    refetch: () => void;
  },
  messagesQuery: null as unknown as {
    data?: NcpSessionMessagesView;
    isLoading: boolean;
    error: Error | null;
  }
}));

vi.mock('@/hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({
    confirm: mocks.confirm,
    ConfirmDialog: () => null
  })
}));

vi.mock('@/hooks/useConfig', () => ({
  useNcpSessions: () => mocks.sessionsQuery,
  useNcpSessionMessages: () => mocks.messagesQuery,
  useUpdateNcpSession: () => ({
    mutate: mocks.updateMutate,
    isPending: false
  }),
  useDeleteNcpSession: () => ({
    mutate: mocks.deleteMutate,
    isPending: false
  })
}));

function createSessionSummary(overrides: Partial<NcpSessionsListView['sessions'][number]> = {}) {
  return {
    sessionId: 'discord:session-1',
    messageCount: 2,
    updatedAt: '2026-04-20T20:00:00.000Z',
    status: 'running' as const,
    metadata: {
      label: 'Release 42',
      preferredModel: 'gpt-4.1'
    },
    ...overrides
  };
}

function createMessage(overrides: Partial<NcpMessageView> = {}): NcpMessageView {
  return {
    id: 'message-1',
    sessionId: 'discord:session-1',
    role: 'assistant',
    status: 'final',
    timestamp: '2026-04-20T20:00:00.000Z',
    parts: [{ type: 'text', text: 'History payload' }],
    ...overrides
  };
}

describe('SessionsConfig', () => {
  beforeEach(() => {
    setLanguage('en');
    mocks.confirm.mockReset();
    mocks.refetch.mockReset();
    mocks.updateMutate.mockReset();
    mocks.deleteMutate.mockReset();
    mocks.confirm.mockResolvedValue(true);
    mocks.sessionsQuery = {
      data: {
        total: 1,
        sessions: [createSessionSummary()]
      },
      isLoading: false,
      isFetching: false,
      refetch: mocks.refetch
    };
    mocks.messagesQuery = {
      data: {
        sessionId: 'discord:session-1',
        status: 'idle',
        total: 1,
        messages: [createMessage()]
      },
      isLoading: false,
      error: null
    };
    if (!HTMLElement.prototype.hasPointerCapture) {
      HTMLElement.prototype.hasPointerCapture = () => false;
    }
    if (!HTMLElement.prototype.setPointerCapture) {
      HTMLElement.prototype.setPointerCapture = () => {};
    }
    if (!HTMLElement.prototype.releasePointerCapture) {
      HTMLElement.prototype.releasePointerCapture = () => {};
    }
  });

  it('saves session metadata through the feature-root page', async () => {
    const user = userEvent.setup();

    render(<SessionsConfig />);

    expect(screen.getByText('No Session Selected')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Release 42/i }));
    expect(screen.getByText('History payload')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Metadata' }));
    await user.clear(screen.getByPlaceholderText('Session label (optional)'));
    await user.type(screen.getByPlaceholderText('Session label (optional)'), '  Batch 30  ');
    await user.clear(screen.getByPlaceholderText('Preferred model (optional)'));
    await user.type(screen.getByPlaceholderText('Preferred model (optional)'), '  gpt-5.4  ');
    await user.click(screen.getByRole('button', { name: 'Save metadata' }));

    expect(mocks.updateMutate).toHaveBeenCalledWith({
      sessionId: 'discord:session-1',
      data: {
        label: 'Batch 30',
        preferredModel: 'gpt-5.4'
      }
    });
  });

  it('deletes the selected session after confirmation', async () => {
    const user = userEvent.setup();

    render(<SessionsConfig />);

    await user.click(screen.getByRole('button', { name: /Release 42/i }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expect(mocks.deleteMutate).toHaveBeenCalledWith(
      { sessionId: 'discord:session-1' },
      expect.objectContaining({
        onSuccess: expect.any(Function)
      })
    );
  });
});
