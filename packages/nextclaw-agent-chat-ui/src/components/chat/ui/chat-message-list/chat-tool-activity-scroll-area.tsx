import { useLayoutEffect, useRef, type ReactNode } from "react";

/** Bounds tool inspection without moving the surrounding conversation. */
export function ChatToolActivityScrollArea({ children, label }: {
  children: ReactNode;
  label: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    const content = contentRef.current;
    if (!scroll || !content) return;
    const updateEdges = () => {
      const top = scroll.scrollTop > 1;
      const bottom = scroll.scrollHeight - scroll.clientHeight - scroll.scrollTop > 1;
      const mask = top || bottom
        ? `linear-gradient(to bottom, ${top ? "transparent, black 16px" : "black"}, ${bottom ? "black calc(100% - 16px), transparent" : "black"})`
        : "none";
      scroll.style.maskImage = mask;
      scroll.style.webkitMaskImage = mask;
    };
    updateEdges();
    scroll.addEventListener("scroll", updateEdges, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateEdges);
    observer?.observe(scroll);
    observer?.observe(content);
    return () => {
      scroll.removeEventListener("scroll", updateEdges);
      observer?.disconnect();
    };
  }, []);

  return (
    <div
      ref={scrollRef}
      role="region"
      aria-label={label}
      tabIndex={0}
      className="max-h-[50dvh] overflow-y-auto custom-scrollbar focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-border"
    >
      <div ref={contentRef} className="text-[0.925rem] leading-[1.72]">{children}</div>
    </div>
  );
}
