import { useEffect } from "react";
import { viewportLayoutManager } from "@/app/managers/viewport-layout.manager";
import { useViewportLayoutStore } from "@/app/stores/viewport-layout.store";

export function useViewportLayout() {
  useEffect(() => viewportLayoutManager.attach(), []);

  const mode = useViewportLayoutStore((state) => state.mode);

  return {
    mode,
    isMobile: mode === "mobile",
    isDesktop: mode === "desktop",
  };
}
