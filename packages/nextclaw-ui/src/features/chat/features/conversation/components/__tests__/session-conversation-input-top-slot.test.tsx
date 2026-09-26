import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/app/components/i18n-provider';
import type { ChatComposerSubmission } from '@/features/chat/stores/chat-composer-draft.store';
import type { SessionConversationInputSnapshot } from '@/features/chat/features/conversation/hooks/use-session-conversation-input-state';
import type { SessionConversationInputController } from '@/features/chat/features/conversation/types/session-conversation-input.types';
import { SessionConversationInputTopSlot } from '@/features/chat/features/conversation/components/session-conversation-input-top-slot';

const submission: ChatComposerSubmission = {
  envelope: {
    sessionId: 'session-confirmation', idempotencyKey: 'user-confirmation',
    message: {
      id: 'user-confirmation', sessionId: 'session-confirmation', role: 'user',
      status: 'final', timestamp: '2026-09-26T00:00:00.000Z',
      parts: [{ type: 'text', text: '你好' }],
    },
  },
  composer: { text: '你好', nodes: [], attachments: [], selectedSkills: [], skillRecords: [] },
  status: 'sending',
};

function renderTopSlot(status: ChatComposerSubmission['status'], queued = false, text = '') {
  const inputSnapshot: SessionConversationInputSnapshot = {
    ...submission.composer, text, composerFocusRequestId: 0, pendingProjectRoot: null,
    pendingSessionType: 'default', selectedModel: null, selectedSessionType: 'default',
    selectedThinkingLevel: null, sendError: null, pendingSubmission: { ...submission, status },
  };
  const controller: SessionConversationInputController = {
    canEditQueuedInput: true, canStopGeneration: true, isSending: true,
    primaryAction: 'send', sendDisabled: true, stopDisabled: false,
    queuedInputs: queued ? [{ id: 'user-confirmation', isSubmitting: true, preview: '你好' }] : [],
    deleteQueuedInput: vi.fn(), editQueuedInput: vi.fn(), steerQueuedInput: vi.fn(),
    send: vi.fn(), sendSteering: vi.fn(), sendPresetMessage: vi.fn(), stop: vi.fn(),
    retryPendingSubmission: vi.fn(), restorePendingSubmission: vi.fn(), discardPendingSubmission: vi.fn(),
  };
  const view = render(<I18nProvider>
    <SessionConversationInputTopSlot inputSnapshot={inputSnapshot} controller={controller} />
  </I18nProvider>);
  return { ...view, controller };
}

describe('SessionConversationInputTopSlot', () => {
  it.each([false, true])('does not add a receipt card during normal sending (queued: %s)', (queued) => {
    const { container } = renderTopSlot('sending', queued);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText('Checking whether the message was received…')).toBeNull();
    expect(screen.queryAllByText('你好')).toHaveLength(queued ? 1 : 0);
    if (!queued) expect(container.childElementCount).toBe(0);
  });

  it('keeps recovery available when the send result is unknown', () => {
    const { controller } = renderTopSlot('uncertain');
    expect(screen.getByRole('status').textContent).toContain('你好');
    fireEvent.click(screen.getByRole('button', { name: 'Check and retry original request' }));
    expect(controller.retryPendingSubmission).toHaveBeenCalledOnce();
  });

  it('does not offer to overwrite new input with a rejected message', () => {
    renderTopSlot('rejected', false, '新的草稿');
    expect(screen.getByRole('status').textContent).toContain('你好');
    expect((screen.getByRole('button', { name: 'Restore message' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Discard failed message' })).toBeTruthy();
  });

  it('lets a rejected message be restored when the composer is empty', () => {
    const { controller } = renderTopSlot('rejected');
    fireEvent.click(screen.getByRole('button', { name: 'Restore message' }));
    expect(controller.restorePendingSubmission).toHaveBeenCalledOnce();
  });
});
