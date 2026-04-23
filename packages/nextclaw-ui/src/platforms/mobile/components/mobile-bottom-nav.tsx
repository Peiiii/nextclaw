import { Link, useLocation } from "react-router-dom";
import {
  getMobileBottomNavItems,
  isSettingsRoute,
} from "@/app/configs/app-navigation.config";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

function isNavItemActive(pathname: string, target: string): boolean {
  if (target === "/settings") {
    return isSettingsRoute(pathname);
  }
  const normalizedPath = pathname.toLowerCase();
  const normalizedTarget = target.toLowerCase();
  return (
    normalizedPath === normalizedTarget ||
    normalizedPath.startsWith(`${normalizedTarget}/`)
  );
}

export function MobileBottomNav() {
  const { pathname } = useLocation();
  const navItems = getMobileBottomNavItems(t);

  return (
    <nav
      data-testid="mobile-bottom-nav"
      aria-label={t("settings")}
      className="shrink-0 border-t border-gray-200/80 bg-white/95 backdrop-blur-sm"
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.25rem)",
      }}
    >
      <ul className="grid grid-cols-4 gap-1 px-2 pt-1">
        {navItems.map((item) => {
          const active = isNavItemActive(pathname, item.target);
          return (
            <li key={item.target}>
              <Link
                to={item.target}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex min-h-[2.875rem] items-center justify-center rounded-xl px-1 py-1 text-[10px] font-medium transition-colors",
                  active
                    ? "text-gray-900"
                    : "text-gray-500 hover:text-gray-800",
                )}
              >
                <span
                  data-testid={active ? "mobile-nav-active-indicator" : undefined}
                  className={cn(
                    "inline-flex max-w-full min-w-14 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1 transition-colors",
                    active ? "bg-gray-100" : "bg-transparent group-hover:bg-gray-50",
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-3.5 w-3.5",
                      active ? "text-gray-900" : "text-gray-400",
                    )}
                  />
                  <span className="max-w-full truncate">{item.label}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
