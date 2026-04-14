import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./app/app";
import { PortalPresenterProvider } from "./app/portal-presenter.service";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <PortalPresenterProvider>
        <App />
      </PortalPresenterProvider>
    </QueryClientProvider>
  </StrictMode>
);
