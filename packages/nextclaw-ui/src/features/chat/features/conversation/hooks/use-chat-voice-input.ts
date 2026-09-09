import { useEffect, useSyncExternalStore } from 'react';
import type { ChatComposerDictationSession } from '@nextclaw/agent-chat-ui';
import type { ChatVoiceInputManager } from '@/features/chat/managers/chat-voice-input.manager';
import { useChatVoiceShortcutStore } from '@/features/chat/stores/chat-voice-shortcut.store';

export function useChatVoiceInput(manager: ChatVoiceInputManager, context: string, language: string,
  keyboardEnabled: boolean, beginDraft: () => ChatComposerDictationSession | null) {
  const snapshot = useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getSnapshot);
  const shortcut = useChatVoiceShortcutStore((state) => state.shortcut);
  useEffect(() => {
    if (!keyboardEnabled || !shortcut) return;
    let held = false;
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.repeat || event.code !== shortcut.code ||
        event.ctrlKey !== shortcut.ctrl || event.metaKey !== shortcut.meta ||
        event.altKey !== shortcut.alt || event.shiftKey !== shortcut.shift ||
        !document.hasFocus()) return;
      if (!['idle', 'ready'].includes(manager.getSnapshot().phase)) return;
      const editable = event.target instanceof HTMLElement &&
        (event.target.isContentEditable || event.target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'));
      if (editable && !shortcut.ctrl && !shortcut.meta && !shortcut.alt) return;
      event.preventDefault();
      held = true;
      manager.start(language, context, beginDraft());
    };
    const keyup = (event: KeyboardEvent) => {
      if (held && (event.code === shortcut.code || ['Alt', 'Control', 'Meta', 'Shift'].includes(event.key))) {
        held = false; manager.finish();
      }
    };
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    return () => {
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      if (held) manager.cancel();
    };
  }, [manager, context, language, keyboardEnabled, beginDraft, shortcut]);
  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.isComposing || ['idle', 'ready'].includes(manager.getSnapshot().phase)) return;
      event.preventDefault();
      event.stopPropagation();
      manager.saveAndClose();
    };
    window.addEventListener('keydown', onEscape, true);
    return () => { window.removeEventListener('keydown', onEscape, true); };
  }, [manager]);
  useEffect(() => {
    const onVisibility = () => { if (document.hidden) manager.interrupt(); };
    // Native authorization prompts can blur the window before recognition starts.
    // Actual page departure is handled independently, including pending requests.
    const onBlur = () => { if (manager.getSnapshot().phase !== 'starting') manager.interrupt(); };
    window.addEventListener('blur', onBlur);
    window.addEventListener('pagehide', manager.cancel);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pagehide', manager.cancel);
      document.removeEventListener('visibilitychange', onVisibility);
      manager.cancel();
    };
  }, [manager, context]);
  return snapshot;
}
