import type {
  ComponentPropsWithoutRef,
  MouseEvent,
  ReactNode,
} from "react";
import { ExternalLink as ExternalLinkIcon, type LucideIcon } from "lucide-react";
import { hostCapabilityManager } from "@/shared/lib/host-capabilities";
import { cn } from "@/shared/lib/utils";

type NavigationLinkProps = Omit<
  ComponentPropsWithoutRef<"a">,
  "children" | "href"
> & {
  children: ReactNode;
  external?: boolean;
  href: string;
  icon?: LucideIcon | null;
  iconPosition?: "leading" | "trailing";
  size?: "xs" | "sm";
};

const LINK_SIZE_CLASS = {
  xs: "gap-1.5 text-xs",
  sm: "gap-1.5 text-sm",
} as const;

const LINK_ICON_SIZE_CLASS = {
  xs: "h-3.5 w-3.5",
  sm: "h-4 w-4",
} as const;

function shouldUseHostNavigation(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button === 0 &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey
  );
}

function resolveExternalRel(rel?: string): string {
  return Array.from(
    new Set(`${rel ?? ""} noopener noreferrer`.trim().split(/\s+/)),
  ).join(" ");
}

function resolveExternalHttpUrl(href: string): string | null {
  try {
    const url = new URL(href, window.location.href);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

/**
 * Shared navigation primitive for visible URL destinations.
 * External links retain native link semantics while delegating ordinary clicks
 * to the desktop host when one is available.
 */
export function NavigationLink({
  children,
  className,
  external = false,
  href,
  icon,
  iconPosition = "leading",
  onClick,
  rel,
  size = "sm",
  target,
  ...props
}: NavigationLinkProps) {
  const Icon = icon === undefined && external ? ExternalLinkIcon : icon;
  const linkIcon = Icon ? (
    <Icon
      aria-hidden="true"
      className={cn("shrink-0", LINK_ICON_SIZE_CLASS[size])}
    />
  ) : null;

  return (
    <a
      {...props}
      href={href}
      target={external ? target ?? "_blank" : target}
      rel={external ? resolveExternalRel(rel) : rel}
      className={cn(
        "inline-flex items-center rounded-sm font-medium text-primary underline-offset-4 transition-colors hover:text-primary-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
        LINK_SIZE_CLASS[size],
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        const externalHttpUrl = external
          ? resolveExternalHttpUrl(href)
          : null;
        if (
          externalHttpUrl &&
          !event.defaultPrevented &&
          shouldUseHostNavigation(event)
        ) {
          event.preventDefault();
          void hostCapabilityManager.openExternalUrl(externalHttpUrl);
        }
      }}
    >
      {iconPosition === "leading" ? linkIcon : null}
      {children}
      {iconPosition === "trailing" ? linkIcon : null}
    </a>
  );
}
