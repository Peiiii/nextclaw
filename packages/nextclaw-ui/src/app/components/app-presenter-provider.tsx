import { createContext, useContext, useMemo, type Context, type ReactNode } from 'react';
import { getAppPresenter, type AppPresenter } from '@/app/presenters/app.presenter';

type AppPresenterContextGlobal = typeof globalThis & {
  __NEXTCLAW_APP_PRESENTER_CONTEXT__?: Context<AppPresenter | null>;
};

const appPresenterContextGlobal = globalThis as AppPresenterContextGlobal;
const AppPresenterContext =
  appPresenterContextGlobal.__NEXTCLAW_APP_PRESENTER_CONTEXT__ ??
  createContext<AppPresenter | null>(null);

appPresenterContextGlobal.__NEXTCLAW_APP_PRESENTER_CONTEXT__ = AppPresenterContext;

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
