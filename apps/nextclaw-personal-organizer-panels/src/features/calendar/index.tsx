import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CalendarApp } from "./components/calendar-app";
import "@shared/styles/panel.css";

const root = document.getElementById("root");
if (!root) throw new Error("Calendar panel root is missing.");

createRoot(root).render(
  <StrictMode>
    <CalendarApp />
  </StrictMode>,
);
