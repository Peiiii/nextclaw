import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getTheme,
  initializeTheme,
  setTheme as applyTheme,
  subscribeThemeChange,
  type UiTheme,
} from '@/lib/theme';
import { pwaShellThemeManager } from '@/pwa/managers/pwa-shell-theme.manager';

type ThemeContextValue = {
  theme: UiTheme;
  setTheme: (theme: UiTheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<UiTheme>(() => initializeTheme());

  useEffect(() => {
    pwaShellThemeManager.syncTheme(theme);
  }, [theme]);

  useEffect(() => {
    const unsubscribe = subscribeThemeChange((nextTheme) => {
      setThemeState(nextTheme);
    });
    return unsubscribe;
  }, []);

  const setTheme = useCallback((nextTheme: UiTheme) => {
    applyTheme(nextTheme);
    setThemeState(getTheme());
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
