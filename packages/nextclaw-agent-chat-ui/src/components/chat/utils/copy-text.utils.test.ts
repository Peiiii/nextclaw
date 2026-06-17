import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './copy-text.utils';

function setClipboard(writeText?: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  });
}

function setExecCommand(execCommand: (command: string) => boolean) {
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: execCommand,
  });
}

afterEach(() => {
  document.body.innerHTML = '';
  setClipboard();
  vi.restoreAllMocks();
});

describe('copyText', () => {
  it('uses navigator clipboard when it is available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const execCommand = vi.fn().mockReturnValue(true);
    setClipboard(writeText);
    setExecCommand(execCommand);

    await expect(copyText('hello')).resolves.toBe(true);

    expect(writeText).toHaveBeenCalledWith('hello');
    expect(execCommand).not.toHaveBeenCalled();
  });

  it('falls back to a temporary textarea and restores the active input selection', async () => {
    const input = document.createElement('input');
    input.value = 'abcdef';
    document.body.appendChild(input);
    input.focus();
    input.setSelectionRange(1, 3);
    setClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    setExecCommand(vi.fn().mockReturnValue(true));

    await expect(copyText('fallback text')).resolves.toBe(true);

    expect(document.querySelector('textarea[aria-hidden="true"]')).toBeNull();
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(1);
    expect(input.selectionEnd).toBe(3);
  });

  it('returns false for empty text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);

    await expect(copyText('')).resolves.toBe(false);

    expect(writeText).not.toHaveBeenCalled();
  });
});
