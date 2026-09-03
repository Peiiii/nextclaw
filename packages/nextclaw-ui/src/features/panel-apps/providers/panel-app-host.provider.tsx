import {
  createContext,
  useContext,
  useMemo,
  type Context,
  type ReactNode,
} from "react";
import { PanelAppHostPresenter } from "@/features/panel-apps/presenters/panel-app-host.presenter";

type PanelAppHostContextGlobal = typeof globalThis & {
  __NEXTCLAW_PANEL_APP_HOST_CONTEXT__?: Context<PanelAppHostPresenter | null>;
};

const contextGlobal = globalThis as PanelAppHostContextGlobal;
const PanelAppHostContext =
  contextGlobal.__NEXTCLAW_PANEL_APP_HOST_CONTEXT__ ??
  createContext<PanelAppHostPresenter | null>(null);

contextGlobal.__NEXTCLAW_PANEL_APP_HOST_CONTEXT__ = PanelAppHostContext;

export function PanelAppHostProvider({
  children,
  presenter: providedPresenter,
}: {
  children: ReactNode;
  presenter?: PanelAppHostPresenter;
}) {
  const presenter = useMemo(
    () => providedPresenter ?? new PanelAppHostPresenter(),
    [providedPresenter],
  );
  return (
    <PanelAppHostContext.Provider value={presenter}>
      {children}
    </PanelAppHostContext.Provider>
  );
}

export function usePanelAppHostPresenter(): PanelAppHostPresenter {
  const presenter = useContext(PanelAppHostContext);
  if (!presenter) {
    throw new Error("usePanelAppHostPresenter must be used inside PanelAppHostProvider");
  }
  return presenter;
}
