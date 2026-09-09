import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatVoiceInputManager, type SpeechRecognitionLike } from '@/features/chat/managers/chat-voice-input.manager';
import { useChatVoiceInput } from '@/features/chat/features/conversation/hooks/use-chat-voice-input';
import { isVoiceShortcut, useChatVoiceShortcutStore } from '@/features/chat/stores/chat-voice-shortcut.store';
import type { ChatComposerDictationSession } from '@nextclaw/agent-chat-ui';

class Recognition implements SpeechRecognitionLike {
  lang = '';
  continuous = false;
  interimResults = false;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
  onstart: SpeechRecognitionLike['onstart'] = null;
  onend: SpeechRecognitionLike['onend'] = null;
  onerror: SpeechRecognitionLike['onerror'] = null;
  onresult: SpeechRecognitionLike['onresult'] = null;
  result = (...texts: string[]) => this.onresult?.({ results: texts.map((transcript) => ({ isFinal: true, 0: { transcript } })) });
}
let recognition: Recognition;
let manager: ChatVoiceInputManager;
let commit = vi.fn<(text?: string) => void>();
let draft: ChatComposerDictationSession;
const beginDraft = () => draft;
beforeEach(() => {
  vi.useFakeTimers();
  recognition = new Recognition();
  manager = new ChatVoiceInputManager(() => recognition, async () => null);
  commit = vi.fn<(text?: string) => void>();
  draft = { commit, update: vi.fn(), cancel: vi.fn() };
  useChatVoiceShortcutStore.getState().setShortcut(null);
  vi.spyOn(document, 'hasFocus').mockReturnValue(true);
});
afterEach(() => {
  act(() => { manager.cancel(); });
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('dictation lifecycle', () => {
  it('saves on exit only after the final tail arrives and closes without rolling back the draft', async () => {
    manager.start('en', 'one', draft);
    await Promise.resolve();
    recognition.onstart?.();
    recognition.result('hello');
    manager.saveAndClose();
    manager.saveAndClose();
    expect(recognition.stop).toHaveBeenCalledOnce();
    expect(commit).not.toHaveBeenCalled();
    recognition.result('hello', 'tail');
    recognition.onend?.();
    expect(draft.update).toHaveBeenLastCalledWith('hello tail', '');
    expect(commit).toHaveBeenCalledOnce();
    expect(draft.cancel).not.toHaveBeenCalled();
    expect(manager.getSnapshot().phase).toBe('idle');
  });
  it.each(['timeout', 'network'])('preserves visible dictation on explicit exit even if finalization reports %s', async (error) => {
    manager.start('en', 'one', draft);
    await Promise.resolve();
    recognition.onstart?.();
    recognition.onresult?.({ results: [{ isFinal: false, 0: { transcript: 'visible words' } }] });
    manager.saveAndClose();
    if (error === 'timeout') vi.advanceTimersByTime(8000);
    else recognition.onerror?.({ error });
    expect(commit).toHaveBeenCalledExactlyOnceWith();
    expect(draft.cancel).not.toHaveBeenCalled();
    expect(manager.getSnapshot().phase).toBe('idle');
  });
  it('does not count time spent in the explicit permission prompt as a speech-service timeout', async () => {
    let resolveCheck!: (value: null) => void;
    manager = new ChatVoiceInputManager(() => recognition,
      () => new Promise<null>((resolve) => { resolveCheck = resolve; }));
    manager.start('en', 'one', draft);
    vi.advanceTimersByTime(30000);
    expect(manager.getSnapshot().phase).toBe('starting');
    resolveCheck(null);
    await Promise.resolve();
    expect(recognition.start).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(15000);
    expect(manager.getSnapshot().error).toBe('timeout');
  });
  it('checks permission on retry and ignores a successful check after cancellation', async () => {
    let resolveCheck!: (value: null) => void;
    const check = vi.fn().mockResolvedValueOnce('permission')
      .mockImplementationOnce(() => new Promise<null>((resolve) => { resolveCheck = resolve; }));
    manager = new ChatVoiceInputManager(() => recognition, check);
    manager.start('en', 'one', draft);
    await Promise.resolve();
    manager.start('en', 'one', draft);
    expect(check).toHaveBeenCalledTimes(2);
    manager.cancel();
    resolveCheck(null);
    await Promise.resolve();
    expect(recognition.start).not.toHaveBeenCalled();
    expect(manager.getSnapshot().phase).toBe('idle');
  });
  it('starts again after a successful permission check and identifies missing devices', async () => {
    const check = vi.fn().mockResolvedValueOnce('no-device').mockResolvedValueOnce(null);
    manager = new ChatVoiceInputManager(() => recognition, check);
    manager.start('en', 'one', draft);
    await Promise.resolve();
    expect(manager.getSnapshot().error).toBe('no-device');
    manager.start('en', 'one', draft);
    await Promise.resolve();
    expect(recognition.start).toHaveBeenCalledOnce();
    recognition.onstart?.();
    expect(manager.getSnapshot().phase).toBe('recording');
  });
  it('waits for the final transcript before opening settings without restarting recording', async () => {
    manager.start('zh', 'one', draft);
    await Promise.resolve();
    recognition.onstart?.();
    recognition.result('first');
    manager.openSettings();
    expect(manager.getSnapshot().phase).toBe('stopping');
    expect(commit).not.toHaveBeenCalled();
    recognition.result('first', 'tail');
    recognition.onend?.();
    expect(commit).toHaveBeenCalledExactlyOnceWith('first tail');
    expect(manager.getSnapshot().phase).toBe('ready');
    manager.cancel();
    expect(recognition.start).toHaveBeenCalledOnce();
  });
  it('still opens settings when finishing recognition fails', async () => {
    manager.start('en', 'one', draft);
    await Promise.resolve();
    recognition.onstart?.();
    manager.openSettings();
    recognition.onerror?.({ error: 'no-speech' });
    expect(manager.getSnapshot()).toMatchObject({ phase: 'ready', error: null, text: '', interim: '' });
  });
  it('replaces cumulative results, waits for the final tail, and inserts once', async () => {
    manager.start('zh', 'one', draft);
    await Promise.resolve();
    expect(manager.getSnapshot().phase).toBe('starting');
    recognition.onstart?.();
    recognition.result('hello');
    recognition.result('hello', 'world');
    expect(commit).not.toHaveBeenCalled();
    manager.finish();
    expect(recognition.stop).toHaveBeenCalledOnce();
    recognition.result('hello', 'world', 'again');
    recognition.onend?.();
    expect(commit).toHaveBeenCalledExactlyOnceWith('hello world again');
    expect(manager.getSnapshot().phase).toBe('idle');
  });
  it('ignores late callbacks after cancellation and a new recording', () => {
    manager.start('en', 'one', draft);
    const lateEnd = recognition.onend;
    const lateResult = recognition.onresult;
    manager.cancel();
    expect(recognition.abort).toHaveBeenCalledOnce();
    recognition = new Recognition();
    manager.start('zh', 'two', draft);
    lateResult?.({ results: [{ isFinal: true, 0: { transcript: 'old' } }] });
    lateEnd?.();
    expect(commit).not.toHaveBeenCalled();
    expect(manager.getSnapshot().text).toBe('');
    expect(recognition.lang).toBe('zh-CN');
  });
  it('cancels a quick release before permission or onstart without later recording', () => {
    manager.start('en', 'one', draft);
    const lateStart = recognition.onstart;
    manager.finish();
    lateStart?.();
    expect(recognition.abort).toHaveBeenCalledOnce();
    expect(manager.getSnapshot().phase).toBe('idle');
    vi.advanceTimersByTime(20000);
    expect(manager.getSnapshot().phase).toBe('idle');
  });
  it.each(['not-allowed', 'network', 'audio-capture', 'no-speech'])('surfaces %s without modifying the draft', (error) => {
    manager.start('en', 'one', draft);
    recognition.onerror?.({ error });
    expect(manager.getSnapshot().phase).toBe('error');
    expect(recognition.abort).toHaveBeenCalledOnce();
    expect(commit).not.toHaveBeenCalled();
  });
  it('commits confirmed text on interruption without a second insertion', async () => {
    manager.start('en', 'one', draft);
    await Promise.resolve();
    recognition.onstart?.();
    recognition.result('keep this');
    manager.interrupt();
    expect(commit).toHaveBeenCalledExactlyOnceWith('keep this');
    manager.cancel();
    expect(commit).toHaveBeenCalledOnce();
  });
  it('times out startup and stopping and ends recording at 60 seconds', async () => {
    manager.start('en', 'one', draft);
    await Promise.resolve();
    vi.advanceTimersByTime(15000);
    expect(manager.getSnapshot().error).toBe('timeout');
    manager.start('en', 'one', draft);
    await Promise.resolve();
    recognition.onstart?.();
    vi.advanceTimersByTime(60000);
    expect(manager.getSnapshot().phase).toBe('stopping');
    expect(recognition.stop).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(8000);
    expect(manager.getSnapshot().error).toBe('timeout');
  });
  it('handles unsupported APIs and thrown starts', async () => {
    const unsupported = new ChatVoiceInputManager(() => null);
    unsupported.start('en', 'one', draft);
    expect(unsupported.getSnapshot().error).toBe('unsupported');
    recognition.start.mockImplementation(() => { throw new Error('device'); });
    manager.start('en', 'one', draft);
    await Promise.resolve();
    expect(manager.getSnapshot().error).toBe('failed');
  });

});

describe('keyboard and page integration', () => {
  it('keeps a pending authorization alive across window blur and starts after permission is granted', async () => {
    renderHook(() => useChatVoiceInput(manager, 'one', 'en', true, beginDraft));
    act(() => { manager.start('en', 'one', draft); window.dispatchEvent(new Event('blur')); });
    expect(manager.getSnapshot().phase).toBe('starting');
    expect(recognition.abort).not.toHaveBeenCalled();
    await act(async () => { await Promise.resolve(); recognition.onstart?.(); });
    expect(manager.getSnapshot().phase).toBe('recording');
  });
  it.each(['visibilitychange', 'pagehide'])('cancels pending authorization on %s and ignores a late grant', (event) => {
    renderHook(() => useChatVoiceInput(manager, 'one', 'en', true, beginDraft));
    act(() => { manager.start('en', 'one', draft); });
    const lateStart = recognition.onstart;
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => { (event === 'pagehide' ? window : document).dispatchEvent(new Event(event)); lateStart?.(); });
    expect(recognition.abort).toHaveBeenCalledOnce();
    expect(manager.getSnapshot().phase).not.toBe('recording');
  });
  it('still interrupts active recording on window blur', async () => {
    renderHook(() => useChatVoiceInput(manager, 'one', 'en', true, beginDraft));
    await act(async () => { manager.start('en', 'one', draft); await Promise.resolve(); recognition.onstart?.(); window.dispatchEvent(new Event('blur')); });
    expect(manager.getSnapshot().error).toBe('interrupted');
    expect(recognition.abort).toHaveBeenCalledOnce();
  });
  it('still stops an active recording when the page becomes hidden', async () => {
    renderHook(() => useChatVoiceInput(manager, 'one', 'en', true, beginDraft));
    await act(async () => { manager.start('en', 'one', draft); await Promise.resolve(); recognition.onstart?.(); });
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(manager.getSnapshot().error).toBe('interrupted');
    expect(recognition.abort).toHaveBeenCalledOnce();
  });
  const bind = (ctrl = false, alt = false) => useChatVoiceShortcutStore.getState().setShortcut({ code: 'KeyV', ctrl, meta: false, alt, shift: false });
  const key = (type: string, options: KeyboardEventInit = {}) => new KeyboardEvent(type, { code: 'KeyV', bubbles: true, cancelable: true, ...options });
  it('never steals paste, normal typing, or input-method composition', () => {
    bind();
    renderHook(() => useChatVoiceInput(manager, 'one', 'en', true, beginDraft));
    const input = document.createElement('textarea'); document.body.append(input);
    const typing = key('keydown');
    const paste = key('keydown', { ctrlKey: true });
    const composing = key('keydown', { isComposing: true });
    act(() => { input.dispatchEvent(typing); input.dispatchEvent(paste); window.dispatchEvent(composing); });
    expect(typing.defaultPrevented).toBe(false);
    expect(paste.defaultPrevented).toBe(false);
    expect(recognition.start).not.toHaveBeenCalled();
    input.remove();
  });
  it('holds a configured combination and stops when a modifier is released', async () => {
    bind(true, true);
    renderHook(() => useChatVoiceInput(manager, 'one', 'en', true, beginDraft));
    await act(async () => { window.dispatchEvent(key('keydown', { ctrlKey: true, altKey: true })); await Promise.resolve(); recognition.onstart?.(); });
    expect(recognition.start).toHaveBeenCalledOnce();
    act(() => { window.dispatchEvent(key('keyup', { code: 'AltLeft', key: 'Alt' })); });
    expect(recognition.stop).toHaveBeenCalledOnce();
  });
  it('does not register recording shortcuts in a mobile or disabled composer', () => {
    bind();
    renderHook(() => useChatVoiceInput(manager, 'one', 'en', false, beginDraft));
    act(() => { window.dispatchEvent(key('keydown')); });
    expect(recognition.start).not.toHaveBeenCalled();
  });
  it('cancels recording on context switch and unmount', () => {
    const hook = renderHook(({ context }) => useChatVoiceInput(manager, context, 'en', true, beginDraft), { initialProps: { context: 'one' } });
    act(() => { manager.start('en', 'one', draft); });
    hook.rerender({ context: 'two' });
    expect(recognition.abort).toHaveBeenCalledOnce();
    expect(manager.getSnapshot().phase).toBe('idle');
    act(() => { manager.start('en', 'two', draft); });
    hook.unmount();
    expect(recognition.abort).toHaveBeenCalledTimes(2);
  });
  it('rejects editing keys and persisted invalid shortcut definitions', () => {
    expect(isVoiceShortcut({ code: 'KeyV', ctrl: true, meta: false, alt: false, shift: false })).toBe(false);
    expect(isVoiceShortcut({ code: 'Enter', ctrl: false, meta: false, alt: false, shift: false })).toBe(false);
    expect(isVoiceShortcut({ code: 'KeyV', ctrl: false, meta: false, alt: false, shift: false })).toBe(true);
  });
});
