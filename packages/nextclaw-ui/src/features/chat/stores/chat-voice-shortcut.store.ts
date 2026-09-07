import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type VoiceShortcut = { code: string; ctrl: boolean; meta: boolean; alt: boolean; shift: boolean };
export function isVoiceShortcut(value: unknown): value is VoiceShortcut {
  if (!value || typeof value !== 'object') return false;
  const key = value as VoiceShortcut;
  const unmodified = key.ctrl === false && key.meta === false && key.alt === false && key.shift === false;
  return typeof key.code === 'string' && (/^Key[A-Z]$/.test(key.code) || /^F(?:[6-9]|10)$/.test(key.code)) &&
    typeof key.ctrl === 'boolean' && typeof key.meta === 'boolean' &&
    typeof key.alt === 'boolean' && typeof key.shift === 'boolean' &&
    (unmodified || (key.alt && key.ctrl !== key.meta));
}

type ShortcutState = { shortcut: VoiceShortcut | null; setShortcut: (shortcut: VoiceShortcut | null) => void };
export const useChatVoiceShortcutStore = create<ShortcutState>()(persist(
  (set) => ({ shortcut: null, setShortcut: (shortcut) => set({ shortcut }) }),
  {
    name: 'nextclaw.chat.voice-shortcut', version: 1,
    storage: createJSONStorage(() => window.localStorage),
    partialize: (state) => ({ shortcut: state.shortcut }),
    merge: (persisted, current) => {
      const value = (persisted as { shortcut?: unknown } | null)?.shortcut;
      return { ...current, shortcut: isVoiceShortcut(value) ? value : null };
    },
  },
));

export function voiceShortcutLabel(shortcut: VoiceShortcut): string {
  return [shortcut.ctrl && 'Ctrl', shortcut.meta && '⌘', shortcut.alt && 'Alt/⌥', shortcut.shift && 'Shift', shortcut.code.replace(/^Key/, '')].filter(Boolean).join(' + ');
}
