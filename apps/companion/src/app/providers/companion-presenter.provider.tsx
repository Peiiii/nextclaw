import { createContext, useContext, type ReactNode } from "react";

import type { CompanionPresenter } from "../../presenters/companion.presenter.js";

const CompanionPresenterContext = createContext<CompanionPresenter | null>(null);

export function CompanionPresenterProvider({
  presenter,
  children
}: {
  presenter: CompanionPresenter;
  children: ReactNode;
}) {
  return (
    <CompanionPresenterContext.Provider value={presenter}>
      {children}
    </CompanionPresenterContext.Provider>
  );
}

export function usePresenter(): CompanionPresenter {
  const presenter = useContext(CompanionPresenterContext);
  if (!presenter) {
    throw new Error("usePresenter must be used inside CompanionPresenterProvider");
  }
  return presenter;
}
