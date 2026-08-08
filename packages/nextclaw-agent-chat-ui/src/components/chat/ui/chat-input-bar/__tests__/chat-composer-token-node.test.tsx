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
  expect(skillToken?.querySelector('[data-reference-icon="skill"]')).toBeTruthy();
  expect(token?.querySelector('[data-reference-icon="image-file"]')).toBeTruthy();
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
  expect(token?.querySelector('[data-reference-icon="image-file"]')).toBeTruthy();
});

it('uses one semantic icon vocabulary for every composer reference kind', async () => {
  render(
    <ChatInputBar
      composer={{
        disabled: false,
        nodes: [
          createChatComposerTokenNode({ tokenKind: 'panel_app', tokenKey: 'tasks', label: 'Tasks' }),
          createChatComposerTextNode(' '),
          createChatComposerTokenNode({ tokenKind: 'project', tokenKey: '/repo', label: 'NextClaw' }),
          createChatComposerTextNode(' '),
          createChatComposerTokenNode({ tokenKind: 'workspace_directory', tokenKey: 'docs', label: 'docs' }),
          createChatComposerTextNode(' '),
          createChatComposerTokenNode({ tokenKind: 'workspace_file', tokenKey: 'config/settings.json', label: 'settings.json' }),
          createChatComposerTextNode(' '),
          createChatComposerTokenNode({ tokenKind: 'future_reference', tokenKey: 'future', label: 'Future' }),
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

  await waitFor(() => expect(screen.getByText('Future')).toBeTruthy());
  const textbox = screen.getByRole('textbox');
  expect(textbox.querySelector('[data-reference-icon="panel-app"]')).toBeTruthy();
  expect(textbox.querySelector('[data-reference-icon="project"]')).toBeTruthy();
  expect(textbox.querySelector('[data-reference-icon="directory"]')).toBeTruthy();
  expect(textbox.querySelector('[data-reference-icon="data-file"]')).toBeTruthy();
  expect(textbox.querySelector('[data-reference-icon="reference"]')).toBeTruthy();
});

it('renders a workspace excerpt as a compact source-aware token with on-demand preview', async () => {
  const onNodesChange = vi.fn();
  render(
    <ChatInputBar
      composer={{
        disabled: false,
        nodes: [
          createChatComposerTokenNode({
            tokenKind: 'workspace_excerpt',
            tokenKey: 'docs/guide.md#excerpt-1',
            label: 'guide.md',
            data: {
              path: 'docs/guide.md',
              excerpt: 'Requests must include an authorization header.',
              startLine: 32,
              endLine: 34,
            },
          }),
          createChatComposerTextNode(''),
        ],
        excerptCharacterCountTemplate: '{count} characters',
        onNodesChange,
        placeholder: 'Type a message',
        removeTokenLabel: 'Remove reference',
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

  expect(await screen.findByText('guide.md')).toBeTruthy();
  expect(screen.getByText('L32–34')).toBeTruthy();
  expect(screen.getByText('Requests must include an authorization header.')).toBeTruthy();
  const token = screen.getByRole('textbox').querySelector('[data-composer-token-kind="workspace_excerpt"]');
  expect(token?.className).toContain('h-6');
  expect(token?.className).not.toContain('h-auto');
  const removeButton = screen.getByRole('button', { name: 'Remove reference' });
  expect(removeButton.className).toContain('absolute');
  expect(removeButton.className).toContain('opacity-0');
  expect(removeButton.className).toContain('rounded-full');
  expect(removeButton.className).toContain('border-border/70');
  expect(removeButton.className).toContain('bg-transparent');
  expect(removeButton.className).toContain('hover:bg-[var(--interaction-hover)]');
  expect(removeButton.parentElement?.className).toContain('relative');
  expect(removeButton.parentElement?.className).toContain('-mx-1.5');
  expect(removeButton.parentElement?.className).toContain('px-1.5');
  const tokenContent = token?.querySelector('[data-composer-token-content="true"]');
  expect(tokenContent?.className).not.toContain('mask-image:linear-gradient');

  fireEvent.mouseEnter(removeButton.parentElement!);
  expect(removeButton.className).toContain('pointer-events-auto');
  expect(removeButton.className).toContain('opacity-100');
  expect(tokenContent?.className).toContain('mask-image:linear-gradient');

  fireEvent.mouseLeave(removeButton.parentElement!);
  expect(removeButton.className).toContain('pointer-events-none');
  expect(removeButton.className).toContain('opacity-0');

  fireEvent.pointerMove(screen.getByText('guide.md'), { pointerType: 'mouse' });
  const preview = await screen.findByRole('tooltip');
  expect(preview.textContent).toContain('docs/guide.md');
  expect(preview.textContent).toContain('Requests must include an authorization header.');

  fireEvent.click(removeButton);
  await waitFor(() => {
    expect(
      screen.getByRole('textbox').querySelector('[data-composer-token-kind="workspace_excerpt"]'),
    ).toBeNull();
  });
  expect(onNodesChange).toHaveBeenCalled();
});
