import { createContext, useContext, type ReactNode } from 'react';
import { appPresenter, type AppPresenter } from '@/presenter/app.presenter';

const AppPresenterContext = createContext<AppPresenter | null>(null);

type AppPresenterProviderProps = {
  children: ReactNode;
};

export function AppPresenterProvider({ children }: AppPresenterProviderProps) {
  return <AppPresenterContext.Provider value={appPresenter}>{children}</AppPresenterContext.Provider>;
}

export function useAppPresenter() {
  const presenter = useContext(AppPresenterContext);
  if (!presenter) {
    throw new Error('useAppPresenter must be used inside AppPresenterProvider');
  }
  return presenter;
}
