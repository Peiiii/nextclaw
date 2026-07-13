import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ChatSidebarSessionItem } from '@/features/chat/features/session/components/chat-sidebar-session-item';

it('shows session actions only on hover or when an action owns focus', () => {
  render(
    <ChatSidebarSessionItem
      sessionKey="session:current"
      active
      showUnreadDot={false}
      context={{ icon: null, label: null }}
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

  screen.getByText('Current Task').closest('button')?.focus();
  const actions = screen.getByLabelText('Pin session').parentElement;

  expect(actions?.className).toContain('opacity-0');
  expect(actions?.className).toContain('group-hover/session:opacity-100');
  expect(actions?.className).toContain('focus-within:opacity-100');
  expect(actions?.className).not.toContain(
    'group-focus-within/session:opacity-100',
  );
});
