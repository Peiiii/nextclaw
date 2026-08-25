import {
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { ListTree } from "lucide-react";
import { ChatPopoverContent } from "@/features/chat/components/chat-popover-content";
import { IconActionButton } from "@/shared/components/ui/actions/icon-action-button";
import { Popover, PopoverTrigger } from "@/shared/components/ui/popover";
import { t } from "@/shared/lib/i18n";

const HEADING_SELECTOR = "h1, h2, h3, h4, h5, h6";
const HEADING_INDEX_ATTRIBUTE = "data-workspace-markdown-heading-index";
const HEADING_TOP_GAP = 16;

type WorkspaceMarkdownOutlineItem = {
  depth: number;
  index: number;
  label: string;
};

function collectWorkspaceMarkdownOutline(
  container: HTMLElement,
): WorkspaceMarkdownOutlineItem[] {
  const levelStack: number[] = [];
  const items: WorkspaceMarkdownOutlineItem[] = [];

  container
    .querySelectorAll<HTMLElement>(HEADING_SELECTOR)
    .forEach((heading) => {
      heading.removeAttribute(HEADING_INDEX_ATTRIBUTE);
      const label = heading.textContent?.replace(/\s+/g, " ").trim();
      if (!label) return;

      const level = Number(heading.tagName.slice(1));
      while (
        levelStack.length > 0 &&
        levelStack[levelStack.length - 1]! >= level
      ) {
        levelStack.pop();
      }

      const index = items.length;
      heading.setAttribute(HEADING_INDEX_ATTRIBUTE, String(index));
      items.push({ depth: levelStack.length, index, label });
      levelStack.push(level);
    });

  return items;
}

export function WorkspaceMarkdownOutline({
  contentKey,
  documentKey,
  scrollContainerRef,
}: {
  contentKey: string;
  documentKey: string;
  scrollContainerRef: RefObject<HTMLDivElement>;
}) {
  const [items, setItems] = useState<WorkspaceMarkdownOutlineItem[]>([]);
  const [open, setOpen] = useState(false);
  const outlineScrollRef = useRef<HTMLElement | null>(null);
  const outlineScrollTopRef = useRef(0);

  useEffect(() => {
    outlineScrollTopRef.current = 0;
    setOpen(false);
    const container = scrollContainerRef.current;
    if (!container) {
      setItems([]);
      return;
    }

    setItems(collectWorkspaceMarkdownOutline(container));
    return () => {
      container
        .querySelectorAll<HTMLElement>(`[${HEADING_INDEX_ATTRIBUTE}]`)
        .forEach((heading) => heading.removeAttribute(HEADING_INDEX_ATTRIBUTE));
    };
  }, [contentKey, documentKey, scrollContainerRef]);

  if (items.length === 0) return null;

  const label = t("chatWorkspaceMarkdownOutline");
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && outlineScrollRef.current) {
      outlineScrollTopRef.current = outlineScrollRef.current.scrollTop;
    }
    setOpen(nextOpen);
  };
  const handleSelect = (index: number) => {
    const container = scrollContainerRef.current;
    const heading = container?.querySelector<HTMLElement>(
      `[${HEADING_INDEX_ATTRIBUTE}="${index}"]`,
    );
    if (!container || !heading) return;

    handleOpenChange(false);
    const top =
      container.scrollTop +
      heading.getBoundingClientRect().top -
      container.getBoundingClientRect().top;
    container.scrollTo({
      top: Math.max(0, top - HEADING_TOP_GAP),
    });
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <IconActionButton
          icon={<ListTree className="h-3.5 w-3.5" />}
          label={label}
          size="sm"
          tone="surface"
          className="rounded-sm data-[state=open]:bg-gray-200/80 data-[state=open]:text-gray-900"
        />
      </PopoverTrigger>

      <ChatPopoverContent
        align="end"
        className="w-[min(20rem,calc(100vw-1.5rem))] rounded-lg p-1.5"
        data-testid="workspace-markdown-outline-popover"
      >
        <nav
          ref={(node) => {
            outlineScrollRef.current = node;
            if (node) node.scrollTop = outlineScrollTopRef.current;
          }}
          aria-label={label}
          className="max-h-80 overflow-y-auto custom-scrollbar"
        >
          <ul className="space-y-0.5">
            {items.map((item) => (
              <li key={item.index}>
                <button
                  type="button"
                  className="block w-full truncate rounded-md py-1.5 pr-2 text-left text-xs leading-4 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-950 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-border active:bg-gray-200"
                  style={{
                    paddingInlineStart: `${0.5 + item.depth * 0.75}rem`,
                  }}
                  title={item.label}
                  onClick={() => handleSelect(item.index)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </ChatPopoverContent>
    </Popover>
  );
}
