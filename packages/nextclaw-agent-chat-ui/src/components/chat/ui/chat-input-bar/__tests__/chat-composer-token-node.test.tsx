import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
          createChatComposerTextNode(' '),
          createChatComposerTokenNode({ tokenKind: 'skill', tokenKey: 'review', label: 'Review' }),
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
  expect(token?.className).toContain('h-6');
  expect(token?.className).toContain('rounded-[7px]');
  expect(token?.className).toContain('align-middle');
  expect(token?.className).toContain('selection:bg-transparent');
  expect(token?.className).toContain('data-[composer-selected=true]:shadow-[0_0_0_2px_var(--interaction-selection,Highlight)]');
  const skillToken = screen.getByRole('textbox').querySelector('[data-composer-token-key="review"]');
  expect(skillToken?.className).toContain('h-6');
  expect(skillToken?.className).toContain('rounded-[7px]');
  expect(skillToken?.className).toContain('align-middle');
  expect(skillToken?.className).toContain('data-[composer-selected=true]:shadow-[0_0_0_2px_var(--interaction-selection,Highlight)]');
  const iconShell = token?.querySelector('svg')?.closest('span');
  expect(iconShell?.className).toContain('bg-card');
  expect(iconShell?.className).toContain('text-muted-foreground');

  const textbox = screen.getByRole('textbox');
  const range = document.createRange();
  range.selectNodeContents(textbox);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
  fireEvent(document, new Event('selectionchange'));
  await waitFor(() => expect(token?.getAttribute('data-composer-selected')).toBe('true'));
  expect(token?.getAttribute('style')).toContain('var(--interaction-selection)');
});

it('renders an uploaded image preview inside its file token', async () => {
  render(
    <ChatInputBar
      composer={{
        disabled: false,
        nodes: [
          createChatComposerTokenNode({
            tokenKind: 'file',
            tokenKey: 'preview-image',
            label: 'preview.png',
            previewUrl: '/api/ncp/assets/content?uri=preview-image',
          }),
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

  const preview = await screen.findByRole('presentation', { hidden: true });
  expect(preview.getAttribute('src')).toBe('/api/ncp/assets/content?uri=preview-image');
  expect(preview.className).toContain('object-cover');
  expect(preview.parentElement?.className).toContain('h-4');
  const token = screen.getByRole('textbox').querySelector('[data-composer-token-key="preview-image"]');
  expect(token?.className).toContain('h-6');
});
