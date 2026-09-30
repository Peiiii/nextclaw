import { useRef, type RefObject } from "react";
import { useBiboSpaceStore } from "@/features/space";
import { biboCopy } from "@/shared/configs/bibo-copy.config";

export function WorkspaceDivider({ container }: { container: RefObject<HTMLElement> }) {
  const { workspaceRatio, resizeWorkspace } = useBiboSpaceStore();
  const pointer = useRef<number | null>(null);
  const release = () => {
    pointer.current = null;
    if (container.current) delete container.current.dataset.workspaceResizing;
  };
  return <div className="bibo-workspace-divider" role="separator" tabIndex={0} aria-orientation="vertical"
    aria-label={biboCopy.workspaceResize} aria-valuemin={30} aria-valuemax={70} aria-valuenow={Math.round(workspaceRatio * 100)}
    onDoubleClick={() => resizeWorkspace(0.55)}
    onKeyDown={event => {
      if (!["ArrowLeft", "ArrowRight", "Home"].includes(event.key)) return;
      event.preventDefault();
      resizeWorkspace(event.key === "Home" ? 0.55 : workspaceRatio + (event.key === "ArrowLeft" ? 0.02 : -0.02));
    }}
    onPointerDown={event => {
      if (event.button !== 0) return;
      event.preventDefault(); event.currentTarget.focus();
      pointer.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      if (container.current) container.current.dataset.workspaceResizing = "true";
    }}
    onPointerMove={event => {
      if (pointer.current !== event.pointerId || !container.current) return;
      const box = container.current.getBoundingClientRect();
      resizeWorkspace((box.right - event.clientX) / box.width);
    }}
    onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release} />;
}
