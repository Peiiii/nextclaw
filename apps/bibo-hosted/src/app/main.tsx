import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { initializeWorkspaceRouter } from "./workspace-router";
import { useBiboSpaceStore } from "@/features/space";

document.documentElement.dataset.biboTheme = useBiboSpaceStore.getState().theme;
const root = document.getElementById("root");
if (!root) throw new Error("Bibo root is missing");
createRoot(root).render(<RouterProvider router={initializeWorkspaceRouter()} />);
