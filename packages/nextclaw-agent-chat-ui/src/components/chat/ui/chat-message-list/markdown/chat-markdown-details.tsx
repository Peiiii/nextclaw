import { Children, isValidElement, useId, useState, type ReactNode } from "react";
import type { ExtraProps } from "react-markdown";
import { ChevronRight } from "lucide-react";
import { ChatCollapsibleContent } from "@agent-chat-ui/components/chat/ui/chat-message-list/chat-collapsible-content";

type TextNode = { type: string; value?: string; children?: readonly TextNode[] };

function textContent(node: TextNode): string {
  return node.value ?? node.children?.map(textContent).join("") ?? "";
}

export function ChatMarkdownDetails({ node, children, open: initiallyOpen, label }: ExtraProps & {
  children?: ReactNode;
  open?: boolean;
  label: string;
}) {
  const [open, setOpen] = useState(Boolean(initiallyOpen));
  const contentId = useId();
  const summary = node?.children.find(child => child.type === "element" && child.tagName === "summary");
  const title = summary ? textContent(summary) : label;
  const content = Children.toArray(children).filter(child =>
    !isValidElement<ExtraProps>(child) || child.props.node?.tagName !== "summary",
  );
  return (
    <div className="my-3 overflow-hidden rounded-lg border border-border">
      <button type="button" aria-expanded={open} aria-controls={contentId}
        onClick={() => setOpen(value => !value)}
        className="flex min-h-9 w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-[var(--interaction-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]">
        <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none" style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }} />
        <span className="min-w-0 break-words">{title || label}</span>
      </button>
      <div id={contentId}>
        <ChatCollapsibleContent open={open}>{() => (
          <div className="flow-root min-w-0 border-t border-border px-3 py-2">{content}</div>
        )}</ChatCollapsibleContent>
      </div>
    </div>
  );
}
