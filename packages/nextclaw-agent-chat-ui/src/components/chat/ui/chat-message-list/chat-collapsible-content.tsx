import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Lazy content with an interruptible height transition shared by message disclosures. */
export function ChatCollapsibleContent({ open, children }: {
  open: boolean;
  children: () => ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);
  const [present, setPresent] = useState(open);
  // Retain newly opened children if the user reverses before the animation ends.
  if (open && !present) setPresent(true);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const body = bodyRef.current;
    if (!frame || !body) return;
    const isMount = !mountedRef.current;
    mountedRef.current = true;
    frame.inert = !open;
    const finish = () => {
      frame.style.height = open ? "auto" : "0px";
      frame.style.opacity = open ? "1" : "0";
      setPresent(open);
    };
    if (isMount || typeof frame.animate !== "function" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }
    let animation: Animation | null = null;
    const deadline = performance.now() + 200;
    let targetHeight = open ? body.getBoundingClientRect().height : 0;
    const transition = (from: number, to: number) => {
      const opacity = from === 0 ? 0 : Number(getComputedStyle(frame).opacity);
      if (animation) {
        animation.onfinish = null;
        animation.cancel();
      }
      frame.style.height = `${from}px`;
      animation = frame.animate([
        { height: `${from}px`, opacity },
        { height: `${to}px`, opacity: open ? 1 : 0 },
      ], {
        duration: Math.max(0, deadline - performance.now()),
        easing: "cubic-bezier(0.2, 0, 0, 1)",
        fill: "both",
      });
      animation.onfinish = () => {
        finish();
        animation?.cancel();
        animation = null;
      };
    };
    transition(frame.getBoundingClientRect().height, targetHeight);
    // Retarget only this toggle; open ancestors must not replay their children's animation.
    const observer = open && typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => {
      if (!animation) return;
      const nextHeight = body.getBoundingClientRect().height;
      if (Math.abs(nextHeight - targetHeight) < 0.5) return;
      const from = frame.getBoundingClientRect().height;
      targetHeight = nextHeight;
      transition(from, nextHeight);
    }) : null;
    observer?.observe(body);
    return () => {
      observer?.disconnect();
      frame.style.height = `${frame.getBoundingClientRect().height}px`;
      frame.style.opacity = getComputedStyle(frame).opacity;
      if (animation) {
        animation.onfinish = null;
        animation.cancel();
      }
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
