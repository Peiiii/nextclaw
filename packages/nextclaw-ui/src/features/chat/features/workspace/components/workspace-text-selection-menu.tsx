import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { MessageSquarePlus } from "lucide-react";
import {
  buildWorkspaceTextExcerpt,
  WORKSPACE_TEXT_EXCERPT_MAX_CHARACTERS,
  type WorkspaceTextExcerpt,
} from "@/features/chat/features/workspace/utils/workspace-text-excerpt.utils";
import { t } from "@/shared/lib/i18n";

type SelectionMenuState = {
  anchorBottom: number;
  anchorCenter: number;
  anchorTop: number;
  excerpt: WorkspaceTextExcerpt;
  tooLong: boolean;
};

type SelectionMenuPosition = {
  left: number;
  top: number;
};

const SELECTION_MENU_VIEWPORT_GAP = 12;
const SELECTION_MENU_ANCHOR_GAP = 10;

function containsSelection(
  root: HTMLElement,
  selection: Selection,
): selection is Selection & { rangeCount: number } {
  if (selection.rangeCount === 0 || selection.isCollapsed) {
    return false;
  }
  const range = selection.getRangeAt(0);
  return root.contains(range.commonAncestorContainer);
}

function getSelectionAnchorRect(range: Range): DOMRect {
  const rects = typeof range.getClientRects === "function"
    ? Array.from(range.getClientRects()).filter((rect) => rect.width > 0 || rect.height > 0)
    : [];
  return rects.at(-1) ?? range.getBoundingClientRect();
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

export function WorkspaceTextSelectionMenu({
  children,
  fileLabel,
  filePath,
  onAddToChat,
  sourceStartLine,
  sourceText,
}: {
  children: ReactNode;
  fileLabel: string;
  filePath: string;
  onAddToChat?: (excerpt: WorkspaceTextExcerpt) => void;
  sourceStartLine?: number | null;
  sourceText: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
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
    const excerpt = buildWorkspaceTextExcerpt({
      path: filePath,
      label: fileLabel,
      selectedText: selection.toString(),
      sourceText,
      sourceStartLine,
    });
    if (!excerpt) {
      setMenu(null);
      return;
    }
    const rect = getSelectionAnchorRect(selection.getRangeAt(0));
    setMenuPosition(null);
    setMenu({
      anchorBottom: rect.bottom,
      anchorCenter: rect.left + rect.width / 2,
      anchorTop: rect.top,
      excerpt,
      tooLong: excerpt.excerpt.length > WORKSPACE_TEXT_EXCERPT_MAX_CHARACTERS,
    });
  }, [fileLabel, filePath, sourceStartLine, sourceText]);

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
    if (!menu || !button) {
      return;
    }
    const buttonRect = button.getBoundingClientRect();
    const left = clamp(
      menu.anchorCenter - buttonRect.width / 2,
      SELECTION_MENU_VIEWPORT_GAP,
      window.innerWidth - SELECTION_MENU_VIEWPORT_GAP - buttonRect.width,
    );
    const belowTop = menu.anchorBottom + SELECTION_MENU_ANCHOR_GAP;
    const aboveTop = menu.anchorTop - SELECTION_MENU_ANCHOR_GAP - buttonRect.height;
    const fitsBelow = belowTop + buttonRect.height <= window.innerHeight - SELECTION_MENU_VIEWPORT_GAP;
    const preferredTop = fitsBelow ? belowTop : aboveTop;
    const top = clamp(
      preferredTop,
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
      scheduleSelectionRead();
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (menuButtonRef.current?.contains(event.target as Node)) {
        return;
      }
      scheduleSelectionRead();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenu(null);
      }
    };
    const closeMenu = () => setMenu(null);
    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("pointerup", handlePointerUp, true);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("pointerup", handlePointerUp, true);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
      if (selectionReadFrameRef.current !== null) {
        window.cancelAnimationFrame(selectionReadFrameRef.current);
      }
    };
  }, [scheduleSelectionRead]);

  const addSelectionToChat = () => {
    if (!menu || menu.tooLong) {
      return;
    }
    onAddToChat?.(menu.excerpt);
    window.getSelection()?.removeAllRanges();
    setMenu(null);
  };

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
          onClick={addSelectionToChat}
        >
          <MessageSquarePlus aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {menu.tooLong
              ? t("chatWorkspaceExcerptSelectionTooLong")
              : t("chatWorkspaceAddToChat")}
          </span>
        </button>,
        document.body,
      )
    : null;

  return (
    <div
      ref={rootRef}
      className="h-full min-h-0"
      data-workspace-text-selection-root="true"
      onMouseUp={scheduleSelectionRead}
      onKeyUp={scheduleSelectionRead}
    >
      {children}
      {menuNode}
    </div>
  );
}
