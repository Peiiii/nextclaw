import { Boxes } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import {
  getMobileBottomNavItems,
  isSettingsRoute,
  matchesRouteTarget,
} from "@/app/configs/app-navigation.config";
import { openApps } from "@/features/panel-apps";
import { useDocBrowser } from "@/shared/components/doc-browser";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

export function MobileBottomNav() {
  const { pathname } = useLocation();
  const docBrowser = useDocBrowser();

  return (
    <nav
      data-testid="mobile-bottom-nav"
      aria-label={t("settings")}
      className="shrink-0 border-t border-gray-200/80 bg-white/95 backdrop-blur-sm"
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.25rem)",
      }}
    >
      <ul className="grid grid-cols-5 gap-1 px-2 pt-1">
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
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-800",
                )}
              >
                <item.icon
                  className={cn(
                    "h-3.5 w-3.5",
                    active ? "text-gray-900" : "text-gray-400",
                  )}
                />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={() => openApps(docBrowser)}
            className="group flex min-h-[2.875rem] w-full flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1 text-[10px] font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
          >
            <Boxes className="h-3.5 w-3.5 text-gray-400" />
            <span className="max-w-full truncate">{t("appsTitle")}</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
