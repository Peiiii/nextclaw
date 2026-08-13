import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TodosApp } from "./components/todos-app";
import "@shared/styles/panel.css";

const root = document.getElementById("root");
if (!root) throw new Error("Todos panel root is missing.");

createRoot(root).render(
  <StrictMode>
    <TodosApp />
  </StrictMode>,
);
