import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, vi } from 'vitest';
import { ChatVoiceInputManager, type SpeechRecognitionLike } from '@/features/chat/managers/chat-voice-input.manager';

/** Assembled voice/draft lifecycle check, shared with the real streaming input harness. */
export async function verifyVoiceDraftLifecycle(
  renderHarness: (manager: ChatVoiceInputManager, send: () => void) => { unmount: () => void },
) {
  const recognition: SpeechRecognitionLike = {
    lang: '', continuous: false, interimResults: false,
    start: vi.fn(), stop: vi.fn(), abort: vi.fn(),
    onstart: null, onend: null, onresult: null, onerror: null,
  };
  const manager = new ChatVoiceInputManager(() => recognition, async () => null);
  const send = vi.fn();
  const rendered = renderHarness(manager, send);
  try {
    fireEvent.click(screen.getByRole('button', { name: /^(语音输入|Voice input)$/ }));
    const voicePanel = screen.getByRole('region', { name: /^(语音输入|Voice input)$/ });
    expect({ rounded: voicePanel.classList.contains('rounded-full'), fit: voicePanel.classList.contains('w-fit'), fixed: voicePanel.classList.contains('w-80') })
      .toEqual({ rounded: true, fit: true, fixed: false });
    const compactClass = voicePanel.className;
    expect({ esc: voicePanel.textContent?.includes('Esc'), phase: manager.getSnapshot().phase })
      .toEqual({ esc: false, phase: 'starting' });
    await act(async () => { await Promise.resolve(); recognition.onstart?.(); });
    expect(screen.getByRole('region', { name: /^(语音输入|Voice input)$/ })).toBe(voicePanel);
    expect(voicePanel.className).toBe(compactClass);
    expect({ starts: vi.mocked(recognition.start).mock.calls.length, stops: vi.mocked(recognition.stop).mock.calls.length, phase: manager.getSnapshot().phase })
      .toEqual({ starts: 1, stops: 0, phase: 'recording' });
    const textbox = screen.getByRole('textbox');
    const before = textbox.textContent;
    act(() => { recognition.onresult?.({ results: [{ isFinal: false, 0: { transcript: 'speaking' } }] }); });
    await waitFor(() => expect(textbox.textContent).toContain('speaking'));
    expect(textbox.querySelector('[style*="underline"]')?.textContent).toBe('speaking');
    act(() => { recognition.onresult?.({ results: [{ isFinal: false, 0: { transcript: 'speak' } }] }); });
    await waitFor(() => expect(textbox.textContent).not.toContain('speaking'));
    act(() => { recognition.onresult?.({ results: [{ isFinal: true, 0: { transcript: 'spoken' } }] }); });
    expect(screen.queryByRole('button', { name: /^(取消|Cancel)$/ })).toBeNull();
    fireEvent.keyDown(textbox, { key: 'Escape', code: 'Escape' });
    expect(recognition.stop).toHaveBeenCalledOnce();
    expect(voicePanel.className).toBe(compactClass);
    act(() => { recognition.onend?.(); });
    await waitFor(() => expect(textbox.textContent).toContain('spoken'));
    expect(textbox.textContent).toContain(before);
    expect(textbox.querySelector('[style*="underline"]')).toBeNull();
    expect(send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^(语音输入|Voice input)$/ }));
    const lateResult = recognition.onresult;
    const lateEnd = recognition.onend;
    fireEvent.keyDown(textbox, { key: 'Escape', code: 'Escape' });
    act(() => {
      lateResult?.({ results: [{ isFinal: true, 0: { transcript: 'discard' } }] }); lateEnd?.();
    });
    expect(textbox.textContent).not.toContain('discard');
    fireEvent.click(screen.getByRole('button', { name: /^(语音输入|Voice input)$/ }));
    await act(async () => { await Promise.resolve(); recognition.onstart?.(); });
    fireEvent.click(screen.getByRole('button', { name: /^(语音快捷键|Voice shortcut)$/ }));
    act(() => { recognition.onerror?.({ error: 'no-speech' }); });
    await waitFor(() => expect(screen.getByRole('button', { name: /绑定按键|Bind a key/ })).toBeTruthy());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: /^(重试|Retry)$/ })).toBeNull();
  } finally {
    rendered.unmount();
  }
}
