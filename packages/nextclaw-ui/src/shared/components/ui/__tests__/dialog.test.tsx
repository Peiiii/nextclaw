import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/shared/components/ui/dialog';

describe('Dialog', () => {
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
