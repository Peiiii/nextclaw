import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';

describe('ConfirmDialog', () => {
  it('focuses the confirm action so Enter confirms the dialog', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Delete session"
        description="This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    const confirmButton = await screen.findByRole('button', { name: 'Delete' });
    expect(document.activeElement).toBe(confirmButton);

    await user.keyboard('{Enter}');

    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
