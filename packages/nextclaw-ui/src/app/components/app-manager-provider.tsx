import { createContext, useContext, type ReactNode } from 'react';
import { appManager, type AppManager } from '@/app/managers/app.manager';

const AppManagerContext = createContext<AppManager | null>(null);

type AppManagerProviderProps = {
  children: ReactNode;
};

export function AppManagerProvider({ children }: AppManagerProviderProps) {
  return <AppManagerContext.Provider value={appManager}>{children}</AppManagerContext.Provider>;
}

export function useAppManager() {
  const manager = useContext(AppManagerContext);
  if (!manager) {
    throw new Error('useAppManager must be used inside AppManagerProvider');
  }
  return manager;
}
