import { useEffect } from "react";

import { CompanionShellContainer } from "./components/companion-shell.container.js";
import { usePresenter } from "./providers/companion-presenter.provider.js";

export function App() {
  const presenter = usePresenter();

  useEffect(() => {
    void presenter.bootstrap();
    return () => {
      presenter.shutdown();
    };
  }, [presenter]);

  return <CompanionShellContainer />;
}
