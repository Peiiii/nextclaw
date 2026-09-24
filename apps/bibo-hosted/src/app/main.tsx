import { createRoot } from "react-dom/client";
import { BiboApp } from "@/features/chat";

const root = document.getElementById("root");
if (!root) throw new Error("Bibo root is missing");
createRoot(root).render(<BiboApp />);
