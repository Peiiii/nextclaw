import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app.js";
import { CompanionPresenterProvider } from "./providers/companion-presenter.provider.js";
import { companionPresenter } from "../presenters/companion.presenter.js";
import "./index.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <CompanionPresenterProvider presenter={companionPresenter}>
      <App />
    </CompanionPresenterProvider>
  </StrictMode>
);
