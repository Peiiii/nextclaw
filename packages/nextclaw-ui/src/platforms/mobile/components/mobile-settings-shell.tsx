import { NavLink } from "react-router-dom";
import { getSettingsNavItems } from "@/app/configs/app-navigation.config";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

export function MobileSettingsShell() {
  const settingsNavItems = getSettingsNavItems(t);

  return (
    <div
      data-testid="mobile-settings-shell"
      className="space-y-3 pb-4"
    >
      {settingsNavItems.map((item) => (
        <NavLink
          key={item.target}
          to={item.target}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-2xl border border-gray-200/80 bg-white px-4 py-4 shadow-card transition-colors",
              isActive
                ? "border-gray-300 bg-gray-50"
                : "hover:border-gray-300 hover:bg-gray-50/70",
            )
          }
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-gray-600">
            <item.icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">
              {item.label}
            </p>
          </div>
        </NavLink>
      ))}
    </div>
  );
}
