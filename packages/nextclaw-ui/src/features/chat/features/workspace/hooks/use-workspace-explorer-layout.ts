import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { usePresenter } from '@/features/chat/components/providers/chat-presenter.provider';
import { useChatThreadStore } from '@/features/chat/stores/chat-thread.store';
import {
  CHAT_WORKSPACE_EXPLORER_COMPACT_THRESHOLD,
  normalizeChatWorkspaceExplorerWidth,
} from '@/features/chat/features/workspace/utils/chat-workspace-panel-layout.utils';

export function useWorkspaceExplorerLayout({
  fileActive,
  projectFilesActive,
}: {
  fileActive: boolean;
  projectFilesActive: boolean;
}) {
  const presenter = usePresenter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resizeRef = useRef<{ startX: number; startWidth: number; width: number } | null>(null);
  const explorerOpen = useChatThreadStore((state) => state.snapshot.workspaceExplorerOpen);
  const persistedExplorerWidth = useChatThreadStore((state) => state.snapshot.workspaceExplorerWidth);
  const setSnapshot = useChatThreadStore((state) => state.setSnapshot);
  const [compact, setCompact] = useState(false);
  const [explorerDragWidth, setExplorerDragWidth] = useState<number | null>(null);
  const explorerWidth = explorerDragWidth ?? persistedExplorerWidth;
  const setExplorerOpen = useCallback(
    (open: boolean) => setSnapshot({ workspaceExplorerOpen: open }),
    [setSnapshot],
  );

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const update = () => setCompact(node.getBoundingClientRect().width < CHAT_WORKSPACE_EXPLORER_COMPACT_THRESHOLD);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!fileActive || !compact || !explorerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExplorerOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [compact, explorerOpen, fileActive, setExplorerOpen]);

  const onResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (compact || !fileActive) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    resizeRef.current = { startX: event.clientX, startWidth: explorerWidth, width: explorerWidth };
    const onMove = (moveEvent: PointerEvent) => {
      const resizing = resizeRef.current;
      if (!resizing) return;
      const width = normalizeChatWorkspaceExplorerWidth(resizing.startWidth + moveEvent.clientX - resizing.startX);
      resizing.width = width;
      setExplorerDragWidth(width);
    };
    const onUp = () => {
      const width = resizeRef.current?.width;
      if (typeof width === 'number') presenter.chatThreadManager.setWorkspaceExplorerWidth(width);
      setExplorerDragWidth(null);
      resizeRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  return {
    compact,
    containerRef,
    explorerOpen,
    explorerOverlay: fileActive && compact && explorerOpen,
    explorerWidth,
    onResizeStart,
    setExplorerOpen,
    showExplorer: projectFilesActive || (fileActive && explorerOpen),
  };
}
