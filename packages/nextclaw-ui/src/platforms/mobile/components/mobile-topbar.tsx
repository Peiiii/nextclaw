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
      data-testid="mobile-topbar"
      className="shrink-0 border-b border-gray-200/80 bg-white/95 backdrop-blur-sm"
      style={{
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.25rem)",
      }}
    >
      <div className="flex min-h-[2.75rem] items-center gap-2 px-3 py-1.5">
        {routeMeta.backTarget ? (
          <button
            type="button"
            onClick={() => navigate(routeMeta.backTarget as string)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
            aria-label={routeMeta.backLabel ?? t("backToMain")}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : (
          null
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-center text-[15px] font-semibold text-gray-900">
            {routeMeta.title}
          </h1>
        </div>
        {routeMeta.backTarget ? <div className="h-8 w-8 shrink-0" aria-hidden="true" /> : null}
      </div>
    </header>
  );
}
