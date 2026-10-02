import { useLayoutEffect, useRef } from "react";

export function useLayoutMotion(contextKey: string) {
  const shellRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const motionKeys = useRef<{ sidebar: string | null; workspace: string | null }>({ sidebar: null, workspace: null });
  useLayoutEffect(() => {
    motionKeys.current = { sidebar: null, workspace: null };
    if (shellRef.current) shellRef.current.dataset.sidebarMotion = "false";
    if (mainRef.current) mainRef.current.dataset.workspaceMotion = "false";
  }, [contextKey]);
  const startSidebarMotion = () => {
    motionKeys.current.sidebar = contextKey;
    if (shellRef.current) shellRef.current.dataset.sidebarMotion = "true";
    if (sidebarRef.current) void getComputedStyle(sidebarRef.current).width;
  };
  const startWorkspaceMotion = () => {
    motionKeys.current.workspace = contextKey;
    if (mainRef.current) {
      mainRef.current.dataset.workspaceMotion = "true";
      // Establish the current geometry before the explicit opening/closing action.
      void getComputedStyle(mainRef.current).gridTemplateColumns;
    }
  };
  return { shellRef, sidebarRef, mainRef, startSidebarMotion, startWorkspaceMotion,
    sidebarMotion: motionKeys.current.sidebar === contextKey, workspaceMotion: motionKeys.current.workspace === contextKey };
}
