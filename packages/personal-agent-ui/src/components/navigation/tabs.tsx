import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes } from "react";
import { Tooltip } from "../overlays/tooltip";

export const TabList = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = "", onKeyDown, ...props }, ref) => <div {...props} ref={ref} role="tablist" className={`ui-tabs ${className}`.trim()} onKeyDown={(event) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || !(event.target instanceof HTMLElement) || event.target.getAttribute("role") !== "tab") return;
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'));
    const index = tabs.indexOf(event.target as HTMLButtonElement);
    const next = event.key === "ArrowRight" ? (index + 1) % tabs.length
      : event.key === "ArrowLeft" ? (index - 1 + tabs.length) % tabs.length
      : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
    if (next >= 0) { event.preventDefault(); tabs[next]?.focus(); }
  }} />,
);
TabList.displayName = "TabList";

export const Tab = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean; label: string }>(
  ({ selected, label, children, className = "", ...props }, ref) => <Tooltip label={label} onlyWhenTruncated={!label.includes("/")}>
    <button {...props} ref={ref} type="button" role="tab" aria-selected={selected} tabIndex={selected ? 0 : -1} className={`ui-tab ${className}`.trim()}>{children}</button>
  </Tooltip>,
);
Tab.displayName = "Tab";
