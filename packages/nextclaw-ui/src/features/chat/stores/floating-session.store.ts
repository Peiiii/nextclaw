import { create } from 'zustand';

export type FloatingSession = { sessionKey: string; title: string };

type FloatingSessionStore = {
  session: FloatingSession | null;
};

export const useFloatingSessionStore = create<FloatingSessionStore>(() => ({
  session: null,
}));
