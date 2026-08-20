import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/app/components/i18n-provider';
import { SessionQueuedInputRows } from '@/features/chat/features/conversation/components/session-queued-input-rows';

describe('SessionQueuedInputRows', () => {
  it('renders queued image thumbnails and file attachments without losing row actions', () => {
    const editQueuedInput = vi.fn();
    render(
      <I18nProvider>
        <SessionQueuedInputRows
          controller={{
            canEditQueuedInput: true,
            deleteQueuedInput: vi.fn(),
            editQueuedInput,
            queuedInputs: [{
              attachments: [
                {
                  mimeType: 'image/png',
                  name: 'diagram.png',
                  previewUrl: 'data:image/png;base64,aW1hZ2U=',
                },
                {
                  mimeType: 'application/pdf',
                  name: 'brief.pdf',
                },
              ],
              id: 'queued-rich-content',
              preview: '结合附件继续',
            }],
            steerQueuedInput: vi.fn(),
          }}
        />
      </I18nProvider>,
    );

    expect(screen.getByRole('img', { name: 'diagram.png' }).getAttribute('src')).toBe(
      'data:image/png;base64,aW1hZ2U=',
    );
    expect(screen.getByText('brief.pdf')).toBeTruthy();
    expect(screen.getByText('结合附件继续')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Edit queued input' }));
    expect(editQueuedInput).toHaveBeenCalledWith('queued-rich-content');
  });
});
