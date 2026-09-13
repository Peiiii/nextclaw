import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Lazy content with an interruptible height transition shared by message disclosures. */
export function ChatCollapsibleContent({ open, children }: {
  open: boolean;
  children: () => ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [present, setPresent] = useState(open);
  // Retain newly opened children if the user reverses before the animation ends.
  if (open && !present) setPresent(true);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const body = bodyRef.current;
    if (!frame || !body) return;
    frame.inert = !open;
    const finish = () => {
      frame.style.height = open ? "auto" : "0px";
      frame.style.opacity = open ? "1" : "0";
      setPresent(open);
    };
    if (typeof frame.animate !== "function" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }
    const from = frame.getBoundingClientRect().height;
    const opacity = from === 0 ? 0 : Number(getComputedStyle(frame).opacity);
    const to = open ? body.getBoundingClientRect().height : 0;
    const animation = frame.animate([
      { height: `${from}px`, opacity },
      { height: `${to}px`, opacity: open ? 1 : 0 },
    ], {
      duration: 200,
      easing: "cubic-bezier(0.2, 0, 0, 1)",
      fill: "both",
    });
    animation.onfinish = () => { finish(); animation.cancel(); };
    return () => {
      frame.style.height = `${frame.getBoundingClientRect().height}px`;
      frame.style.opacity = getComputedStyle(frame).opacity;
      animation.onfinish = null;
      animation.cancel();
    };
  }, [open]);

  return (
    <div ref={frameRef} aria-hidden={!open} style={{ height: 0, overflow: "hidden" }}>
      <div ref={bodyRef} className="flow-root min-w-0">
        {open || present ? children() : null}
      </div>
    </div>
  );
}
