import { ArrowLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { resolveMobileRouteMeta } from "@/app/configs/app-navigation.config";
import { t } from "@/shared/lib/i18n";

export function MobileTopbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const routeMeta = resolveMobileRouteMeta(pathname, t);

  return (
    <header
      className="shrink-0 border-b border-gray-200/80 bg-white/95 backdrop-blur-sm"
      style={{
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.5rem)",
      }}
    >
      <div className="flex min-h-[3.75rem] items-center gap-3 px-4 py-3">
        {routeMeta.backTarget ? (
          <button
            type="button"
            onClick={() => navigate(routeMeta.backTarget as string)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
            aria-label={routeMeta.backLabel ?? t("backToMain")}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : (
          <div className="h-9 w-9 shrink-0" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-gray-900">
            {routeMeta.title}
          </h1>
        </div>
        <div className="h-9 w-9 shrink-0" aria-hidden="true" />
      </div>
    </header>
  );
}
