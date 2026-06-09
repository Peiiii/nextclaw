import { act, render, waitFor } from '@testing-library/react';
import { eventKeys } from '@nextclaw/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  ChatPresenterProvider,
  type ChatPresenterLike,
} from '@/features/chat/components/providers/chat-presenter.provider';
import { useUiShowContentEvent } from '@/features/chat/hooks/use-ui-show-content-event';
import { nextclawClient } from '@/shared/lib/api';

function UiShowContentEventConsumer() {
  useUiShowContentEvent();
  return null;
}

describe('useUiShowContentEvent', () => {
  it('routes ui.show-content events to the chat thread manager from context', async () => {
    const handleUiShowContentEvent = vi.fn();
    const presenter = {
      chatThreadManager: {
        handleUiShowContentEvent,
      },
    } as unknown as ChatPresenterLike;
    const event = {
      id: 'tool:call-show-content-1:show-content',
      toolCallId: 'call-show-content-1',
      target: {
        type: 'url' as const,
        payload: {
          url: 'https://example.com/read',
        },
      },
      title: 'Example URL',
      purpose: 'read' as const,
    };

    const rendered = render(
      <ChatPresenterProvider presenter={presenter}>
        <UiShowContentEventConsumer />
      </ChatPresenterProvider>,
    );

    act(() => {
      nextclawClient.eventBus.emit(eventKeys.uiShowContent, event);
    });

    await waitFor(() => {
      expect(handleUiShowContentEvent).toHaveBeenCalledWith(event);
    });
    rendered.unmount();
  });
});
