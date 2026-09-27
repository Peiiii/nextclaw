import { cloneElement, type ReactElement } from "react";
import { Tooltip } from "../overlays/tooltip";

export function NavigationItem({ label, selected, tooltip = true, truncatedLabel = false, children }: {
  label: string;
  selected: boolean;
  tooltip?: boolean;
  truncatedLabel?: boolean;
  children: ReactElement<{ className?: string; "aria-current"?: "page" }>;
}) {
  return <Tooltip label={label} side="right" enabled={tooltip} onlyWhenTruncated={truncatedLabel}>
    {cloneElement(children, {
      className: `ui-navigation-item ${children.props.className ?? ""}`.trim(),
      "aria-current": selected ? "page" : undefined,
    })}
  </Tooltip>;
}
