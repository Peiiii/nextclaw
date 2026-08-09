import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { MessageSquarePlus } from "lucide-react";

export type ChatTextSelectionSnapshot = {
  range: Range;
  text: string;
};

type SelectionMenuState = {
  anchorBottom: number;
  anchorCenter: number;
  anchorTop: number;
  selection: ChatTextSelectionSnapshot;
  tooLong: boolean;
};

type SelectionMenuPosition = {
  left: number;
  top: number;
};

type SelectionAnchorBounds = {
  bottom: number;
  center: number;
  top: number;
};

const SELECTION_MENU_VIEWPORT_GAP = 12;
const SELECTION_MENU_ANCHOR_GAP = 10;

function containsSelection(root: HTMLElement, selection: Selection): boolean {
  return selection.rangeCount > 0 &&
    !selection.isCollapsed &&
    root.contains(selection.getRangeAt(0).commonAncestorContainer);
}

function readNonEmptyRangeRects(range: Range): DOMRect[] {
  return typeof range.getClientRects === "function"
    ? Array.from(range.getClientRects()).filter((rect) => rect.width > 0 || rect.height > 0)
    : [];
}

function getSelectedTextRects(range: Range): DOMRect[] {
  if (range.commonAncestorContainer.nodeType === Node.TEXT_NODE) {
    return readNonEmptyRangeRects(range);
  }
  const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT);
  const rects: DOMRect[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!(node instanceof Text) || !node.data || !range.intersectsNode(node)) continue;
    const textRange = document.createRange();
    textRange.selectNodeContents(node);
    if (node === range.startContainer) textRange.setStart(node, range.startOffset);
    if (node === range.endContainer) textRange.setEnd(node, range.endOffset);
    rects.push(...readNonEmptyRangeRects(textRange));
  }
  return rects;
}

function getSelectionAnchorBounds(range: Range): SelectionAnchorBounds {
  const textRects = getSelectedTextRects(range);
  const rects = textRects.length > 0 ? textRects : readNonEmptyRangeRects(range);
  const sourceRects = rects.length > 0 ? rects : [range.getBoundingClientRect()];
  const visibleRects = sourceRects
    .map((rect) => ({
      bottom: Math.min(rect.bottom, window.innerHeight),
      left: Math.max(rect.left, 0),
      right: Math.min(rect.right, window.innerWidth),
      top: Math.max(rect.top, 0),
    }))
    .filter((rect) => rect.right > rect.left && rect.bottom > rect.top);
  const anchorRects = visibleRects.length > 0 ? visibleRects : sourceRects;
  const left = Math.min(...anchorRects.map((rect) => rect.left));
  const right = Math.max(...anchorRects.map((rect) => rect.right));
  return {
    bottom: Math.max(...anchorRects.map((rect) => rect.bottom)),
    center: left + (right - left) / 2,
    top: Math.min(...anchorRects.map((rect) => rect.top)),
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

export function ChatTextSelectionAction({
  actionLabel,
  children,
  className = "contents",
  isSelectionAllowed,
  maxCharacters,
  onAddToChat,
  selectionTooLongLabel,
}: {
  actionLabel: string;
  children: ReactNode;
  className?: string;
  isSelectionAllowed?: (selection: ChatTextSelectionSnapshot) => boolean;
  maxCharacters: number;
  onAddToChat?: (selection: ChatTextSelectionSnapshot) => void;
  selectionTooLongLabel: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const pointerSelectionActiveRef = useRef(false);
  const selectionReadFrameRef = useRef<number | null>(null);
  const [menu, setMenu] = useState<SelectionMenuState | null>(null);
  const [menuPosition, setMenuPosition] = useState<SelectionMenuPosition | null>(null);

  const readSelection = useCallback(() => {
    const root = rootRef.current;
    const selection = window.getSelection();
    if (!root || !selection || !containsSelection(root, selection)) {
      setMenu(null);
      return;
    }
    const text = selection.toString().trim();
    if (!text) {
      setMenu(null);
      return;
    }
    const sourceRange = selection.getRangeAt(0);
    const anchor = getSelectionAnchorBounds(sourceRange);
    const range = sourceRange.cloneRange();
    const snapshot = { range, text };
    if (isSelectionAllowed && !isSelectionAllowed(snapshot)) {
      setMenu(null);
      return;
    }
    setMenuPosition(null);
    setMenu({
      anchorBottom: anchor.bottom,
      anchorCenter: anchor.center,
      anchorTop: anchor.top,
      selection: snapshot,
      tooLong: text.length > maxCharacters,
    });
  }, [isSelectionAllowed, maxCharacters]);

  const scheduleSelectionRead = useCallback(() => {
    if (selectionReadFrameRef.current !== null) {
      window.cancelAnimationFrame(selectionReadFrameRef.current);
    }
    selectionReadFrameRef.current = window.requestAnimationFrame(() => {
      selectionReadFrameRef.current = null;
      readSelection();
    });
  }, [readSelection]);

  const captureMenuButton = useCallback((button: HTMLButtonElement | null) => {
    menuButtonRef.current = button;
    if (!menu || !button) return;
    const buttonRect = button.getBoundingClientRect();
    const left = clamp(
      menu.anchorCenter - buttonRect.width / 2,
      SELECTION_MENU_VIEWPORT_GAP,
      window.innerWidth - SELECTION_MENU_VIEWPORT_GAP - buttonRect.width,
    );
    const belowTop = menu.anchorBottom + SELECTION_MENU_ANCHOR_GAP;
    const aboveTop = menu.anchorTop - SELECTION_MENU_ANCHOR_GAP - buttonRect.height;
    const fitsAbove = aboveTop >= SELECTION_MENU_VIEWPORT_GAP;
    const top = clamp(
      fitsAbove ? aboveTop : belowTop,
      SELECTION_MENU_VIEWPORT_GAP,
      window.innerHeight - SELECTION_MENU_VIEWPORT_GAP - buttonRect.height,
    );
    setMenuPosition({ left, top });
  }, [menu]);

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setMenu(null);
        return;
      }
      if (!pointerSelectionActiveRef.current) {
        scheduleSelectionRead();
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      pointerSelectionActiveRef.current = Boolean(
        root && event.target instanceof Node && root.contains(event.target),
      );
      if (pointerSelectionActiveRef.current) setMenu(null);
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (menuButtonRef.current?.contains(event.target as Node)) return;
      const wasSelecting = pointerSelectionActiveRef.current;
      pointerSelectionActiveRef.current = false;
      if (wasSelecting) scheduleSelectionRead();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null);
    };
    const closeMenu = () => setMenu(null);
    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("pointerup", handlePointerUp, true);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("pointerup", handlePointerUp, true);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
      if (selectionReadFrameRef.current !== null) {
        window.cancelAnimationFrame(selectionReadFrameRef.current);
      }
    };
  }, [scheduleSelectionRead]);

  const menuNode = menu && onAddToChat
    ? createPortal(
        <button
          ref={captureMenuButton}
          type="button"
          className="fixed z-[var(--z-popover,10100)] inline-flex max-w-[calc(100vw-24px)] items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-xl border border-border bg-popover px-3 py-2 text-xs font-medium text-popover-foreground shadow-lg transition-colors hover:bg-[var(--interaction-hover)] hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:text-muted-foreground"
          style={{
            left: menuPosition?.left ?? 0,
            top: menuPosition?.top ?? 0,
            visibility: menuPosition ? "visible" : "hidden",
          }}
          disabled={menu.tooLong}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (menu.tooLong) return;
            onAddToChat(menu.selection);
            window.getSelection()?.removeAllRanges();
            setMenu(null);
          }}
        >
          <MessageSquarePlus aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{menu.tooLong ? selectionTooLongLabel : actionLabel}</span>
        </button>,
        document.body,
      )
    : null;

  return (
    <div ref={rootRef} className={className}>
      {children}
      {menuNode}
    </div>
  );
}
