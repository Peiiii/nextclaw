import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { getAppPresenter, type AppPresenter } from '@/app/presenters/app.presenter';

const AppPresenterContext = createContext<AppPresenter | null>(null);

type AppPresenterProviderProps = {
  children: ReactNode;
};

export function AppPresenterProvider({ children }: AppPresenterProviderProps) {
  const presenter = useMemo(() => getAppPresenter(), []);
  return <AppPresenterContext.Provider value={presenter}>{children}</AppPresenterContext.Provider>;
}

export function useAppPresenter() {
  const presenter = useContext(AppPresenterContext);
  if (!presenter) {
    throw new Error('useAppPresenter must be used inside AppPresenterProvider');
  }
  return presenter;
}
