import { Boxes } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import {
  getMobileBottomNavItems,
  isSettingsRoute,
  matchesRouteTarget,
} from "@/app/configs/app-navigation.config";
import { openApps } from "@/features/panel-apps";
import { useInboxUnreadCount } from "@/features/inbox";
import { useDocBrowser } from "@/shared/components/doc-browser";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

export function MobileBottomNav() {
  const { pathname } = useLocation();
  const docBrowser = useDocBrowser();
  const unreadCount = useInboxUnreadCount();

  return (
    <nav
      data-testid="mobile-bottom-nav"
      aria-label={t("settings")}
      className="shrink-0 border-t border-border/60 bg-background text-foreground"
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.25rem)",
      }}
    >
      <ul className="grid grid-cols-6 gap-1 px-2 pt-1">
        {getMobileBottomNavItems(t).map((item) => {
          const active = item.target === "/settings"
            ? isSettingsRoute(pathname)
            : matchesRouteTarget(pathname, item.target);
          return (
            <li key={item.target}>
              <Link
                to={item.target}
                aria-current={active ? "page" : undefined}
                data-testid={active ? "mobile-nav-active-indicator" : undefined}
                className={cn(
                  "group flex min-h-[2.875rem] flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span className="relative">
                  <item.icon
                    className={cn(
                      "h-3.5 w-3.5",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                  />
                  {item.target === "/inbox" && unreadCount > 0 ? (
                    <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-primary ring-1 ring-background" />
                  ) : null}
                </span>
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={() => openApps(docBrowser)}
            className="group flex min-h-[2.875rem] w-full flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
          >
            <Boxes className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="max-w-full truncate">{t("appsTitle")}</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
