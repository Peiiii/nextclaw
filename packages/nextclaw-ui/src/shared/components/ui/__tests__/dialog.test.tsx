import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { t } from '@/shared/lib/i18n';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTrigger,
  DialogTitle,
} from '@/shared/components/ui/dialog';

describe('Dialog', () => {
  it('keeps header actions separate from closing and restores trigger focus', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(<Dialog>
      <DialogTrigger>Open report</DialogTrigger>
      <DialogContent>
        <DialogHeader actions={<button onClick={onAction}>Next report</button>}>
          <DialogTitle>A long report title</DialogTitle>
          <DialogDescription>Report summary</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>);
    await user.click(screen.getByRole('button', { name: 'Open report' }));
    expect(screen.getAllByRole('button', { name: t('close') })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Next report' }));
    expect(onAction).toHaveBeenCalledOnce();
    expect(screen.getByRole('dialog')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: t('close') }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open report' }));
  });

  it('supports explicit confirmation-only headers', () => {
    render(<Dialog open><DialogContent><DialogHeader showClose={false}>
      <DialogTitle>Confirm deletion</DialogTitle>
      <DialogDescription>Choose an action below.</DialogDescription>
    </DialogHeader></DialogContent></Dialog>);
    expect(screen.queryByRole('button', { name: t('close') })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Confirm deletion' })).toBeTruthy();
  });

  it('renders modal layers above floating panels', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Authorize action</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    const dialog = screen.getByRole('dialog');
    const overlay = Array.from(document.body.querySelectorAll('[data-state="open"]'))
      .find((element) => element instanceof HTMLElement && element.className.includes('--z-modal-backdrop'));

    expect(dialog.className).toContain('z-[var(--z-modal,10050)]');
    expect(overlay).toBeInstanceOf(HTMLElement);
    expect((overlay as HTMLElement).className).toContain('z-[var(--z-modal-backdrop,10000)]');
  });
});
