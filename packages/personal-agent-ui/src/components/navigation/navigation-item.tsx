import { cloneElement, forwardRef, type HTMLAttributes, type ReactElement, type Ref } from "react";
import { Tooltip } from "../overlays/tooltip";

export const NavigationItem = forwardRef<HTMLElement, HTMLAttributes<HTMLElement> & {
  label: string;
  selected?: boolean;
  layout?: "row" | "stack" | "icon";
  tooltip?: boolean;
  truncatedLabel?: boolean;
  children: ReactElement<{ className?: string; "aria-current"?: "page"; ref?: Ref<HTMLElement> }>;
}>(function NavigationItem({ label, selected = false, layout = "row", tooltip = true, truncatedLabel = false, children, className = "", ...props }, ref) {
  return <Tooltip label={label} side="right" enabled={tooltip} onlyWhenTruncated={truncatedLabel}>
    {cloneElement(children, {
      ...props,
      ...(ref ? { ref } : {}),
      className: `ui-navigation-item${layout === "row" ? "" : ` ui-navigation-item--${layout}`} ${children.props.className ?? ""} ${className}`.trim(),
      "aria-current": selected ? "page" : undefined,
    })}
  </Tooltip>;
});
