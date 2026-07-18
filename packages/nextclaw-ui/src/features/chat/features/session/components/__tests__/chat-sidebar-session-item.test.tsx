import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { ChatSidebarSessionItem } from '@/features/chat/features/session/components/chat-sidebar-session-item';

beforeEach(() => {
  render(
    <ChatSidebarSessionItem
      sessionKey="session:current"
      active
      showUnreadDot={false}
      context={{
        icon: {
          kind: 'runtime-image',
          src: '/runtime-icons/codex-openai.svg',
          name: 'Codex',
        },
        label: null,
      }}
      isPinned={false}
      title="Current Task"
      previewText="Preview"
      trailingText="Now"
      isEditing={false}
      draftLabel="Current Task"
      isSaving={false}
      onSelect={vi.fn()}
      onStartEditing={vi.fn()}
      onDraftLabelChange={vi.fn()}
      onSave={vi.fn()}
      onCancel={vi.fn()}
      onTogglePinned={vi.fn()}
    />,
  );
});

it('shows session actions only on hover or when an action owns focus', () => {
  screen.getByText('Current Task').closest('button')?.focus();
  const actions = screen.getByLabelText('Pin session').parentElement;

  expect(actions?.className).toContain('opacity-0');
  expect(actions?.className).toContain('group-hover/session:opacity-100');
  expect(actions?.className).toContain('focus-within:opacity-100');
  expect(actions?.className).not.toContain(
    'group-focus-within/session:opacity-100',
  );
});

it('sizes the runtime icon to the session title text', () => {
  const runtimeIcon = screen.getByRole('img', { name: 'Codex logo' });

  expect(runtimeIcon.parentElement?.className).toContain('h-[13px]');
  expect(runtimeIcon.parentElement?.className).toContain('w-[13px]');
  expect(runtimeIcon.parentElement?.parentElement?.className).toContain('h-4');
  expect(runtimeIcon.parentElement?.parentElement?.className).toContain('w-4');
});
