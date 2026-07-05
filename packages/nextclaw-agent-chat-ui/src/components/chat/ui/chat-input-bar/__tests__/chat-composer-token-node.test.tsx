import { render, screen, waitFor } from '@testing-library/react';
import { createChatComposerTextNode, createChatComposerTokenNode } from '@agent-chat-ui/components/chat/ui/chat-input-bar/chat-composer.utils';
import { ChatInputBar } from '@agent-chat-ui/components/chat/ui/chat-input-bar/chat-input-bar';

Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  value: vi.fn(),
  writable: true,
});

it('renders file composer tokens with theme-owned colors', async () => {
  render(
    <ChatInputBar
      composer={{
        disabled: false,
        nodes: [
          createChatComposerTokenNode({ tokenKind: 'file', tokenKey: 'image-file', label: 'image.png' }),
          createChatComposerTextNode(''),
        ],
        onNodesChange: vi.fn(),
        placeholder: 'Type a message',
      }}
      hint={null}
      toolbar={{
        actions: {
          canStopGeneration: false,
          isSending: false,
          onSend: vi.fn(),
          onStop: vi.fn(),
          sendButtonLabel: 'Send',
          sendDisabled: false,
          stopButtonLabel: 'Stop',
          stopDisabled: true,
          stopHint: 'Stop unavailable',
        },
        selects: [],
      }}
    />,
  );

  await waitFor(() => expect(screen.getByText('image.png')).toBeTruthy());
  const token = screen.getByRole('textbox').querySelector('[data-composer-token-key="image-file"]');
  expect(token?.className).toContain('border-border');
  expect(token?.className).toContain('bg-muted');
  expect(token?.className).toContain('text-foreground');
  const iconShell = token?.querySelector('svg')?.closest('span');
  expect(iconShell?.className).toContain('bg-card');
  expect(iconShell?.className).toContain('text-muted-foreground');
});
