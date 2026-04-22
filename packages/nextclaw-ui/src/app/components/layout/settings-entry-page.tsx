import { Navigate } from "react-router-dom";
import { useViewportLayout } from "@/app/hooks/use-viewport-layout";
import { MobileSettingsShell } from "@/platforms/mobile";

export function SettingsEntryPage() {
  const { isMobile } = useViewportLayout();

  if (!isMobile) {
    return <Navigate to="/model" replace />;
  }

  return <MobileSettingsShell />;
}
