import { create } from 'zustand';

type AuthState = {
  token: string | null;
  setToken: (token: string | null) => void;
  logout: () => void;
};

const STORAGE_KEY = 'nextclaw.platform.token';

function readTokenFromStorage(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const token = window.localStorage.getItem(STORAGE_KEY);
  return token && token.trim().length > 0 ? token : null;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: readTokenFromStorage(),
  setToken: (token) => {
    if (typeof window !== 'undefined') {
      if (token) {
        window.localStorage.setItem(STORAGE_KEY, token);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    set({ token });
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    set({ token: null });
  }
}));
