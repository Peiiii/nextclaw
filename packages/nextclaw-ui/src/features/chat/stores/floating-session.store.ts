import { create } from 'zustand';

export type FloatingSession = { sessionKey: string; title: string };

type FloatingSessionStore = {
  session: FloatingSession | null;
  minimized: boolean;
};

export const useFloatingSessionStore = create<FloatingSessionStore>(() => ({
  session: null,
  minimized: false,
}));
