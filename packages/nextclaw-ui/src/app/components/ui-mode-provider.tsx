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
  getMode,
  initializeMode,
  setMode as applyMode,
  subscribeModeChange,
  type UiMode,
} from '@/shared/lib/ui-mode';

type UiModeContextValue = {
  mode: UiMode;
  setMode: (mode: UiMode) => void;
};

const UiModeContext = createContext<UiModeContextValue | null>(null);

export function UiModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<UiMode>(() => initializeMode());

  useEffect(() => {
    const unsubscribe = subscribeModeChange((nextMode) => {
      setModeState(nextMode);
    });
    return unsubscribe;
  }, []);

  const setMode = useCallback((nextMode: UiMode) => {
    applyMode(nextMode);
    setModeState(getMode());
  }, []);

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);

  return <UiModeContext.Provider value={value}>{children}</UiModeContext.Provider>;
}

export function useUiMode(): UiModeContextValue {
  const ctx = useContext(UiModeContext);
  if (!ctx) {
    throw new Error('useUiMode must be used within UiModeProvider');
  }
  return ctx;
}
