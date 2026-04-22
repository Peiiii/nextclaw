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
      aria-label={t("settings")}
      className="shrink-0 border-t border-gray-200/80 bg-white/95 backdrop-blur-sm"
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)",
      }}
    >
      <ul className="grid grid-cols-4 gap-1 px-2 pt-2">
        {navItems.map((item) => {
          const active = isNavItemActive(pathname, item.target);
          return (
            <li key={item.target}>
              <Link
                to={item.target}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[3.5rem] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium transition-colors",
                  active
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-800",
                )}
              >
                <item.icon
                  className={cn(
                    "h-4 w-4",
                    active ? "text-gray-900" : "text-gray-400",
                  )}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
