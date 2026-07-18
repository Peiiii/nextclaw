import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const themePreferences = ['light', 'dark', 'system'] as const;

export type ThemePreference = (typeof themePreferences)[number];

type ThemeState = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

function isThemePreference(value: unknown): value is ThemePreference {
  return themePreferences.includes(value as ThemePreference);
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: 'system',
      setPreference: (preference) => set({ preference })
    }),
    {
      name: 'nextclaw.platform.theme',
      version: 1,
      partialize: (state) => ({ preference: state.preference }),
      merge: (persistedState, currentState) => {
        const preference = (persistedState as Partial<ThemeState> | null)?.preference;
        return {
          ...currentState,
          preference: isThemePreference(preference) ? preference : 'system'
        };
      }
    }
  )
);
