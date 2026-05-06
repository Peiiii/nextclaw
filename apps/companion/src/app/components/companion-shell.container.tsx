import { ExternalLink, X } from "lucide-react";

import { useCompanionRuntimeStore } from "../../stores/companion-runtime.store.js";
import { useCompanionShellStore } from "../../stores/companion-shell.store.js";
import { usePresenter } from "../providers/companion-presenter.provider.js";

export function CompanionShellContainer() {
  const presenter = usePresenter();
  const view = useCompanionRuntimeStore((state) => state.snapshot.currentView);
  const connectionState = useCompanionRuntimeStore((state) => state.snapshot.connectionState);
  const bootstrapped = useCompanionShellStore((state) => state.snapshot.bootstrapped);

  const statusColorClass = connectionState === "running"
    ? "bg-success"
    : connectionState === "offline"
      ? "bg-danger"
      : "bg-slate-300";

  return (
    <div className="h-screen w-screen overflow-hidden bg-transparent">
      <div className="grid h-full place-items-center">
        <div className="grid w-[112px] justify-items-center gap-2">
          <div className="drag-region relative grid h-24 w-24 place-items-center overflow-hidden rounded-[28px] border border-white/70 bg-white/90 shadow-companion backdrop-blur-xl">
            <div className="no-drag absolute right-1.5 top-1.5 z-20 flex gap-1">
              <button
                type="button"
                aria-label="Open NextClaw"
                onClick={() => void presenter.companionShellManager.open()}
                className="grid h-5 w-5 place-items-center rounded-full bg-slate-900/10 text-slate-700 transition hover:bg-slate-900/15"
              >
                <ExternalLink className="h-3 w-3" />
              </button>
              <button
                type="button"
                aria-label="Quit Companion"
                onClick={() => void presenter.companionShellManager.quit()}
                className="grid h-5 w-5 place-items-center rounded-full bg-slate-900/10 text-slate-700 transition hover:bg-slate-900/15"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            {view.avatarUrl ? (
              <img src={view.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="grid h-full w-full place-items-center bg-gradient-to-b from-white to-slate-200 text-[28px] font-bold text-slate-800">
                {(view.title || "NC").slice(0, 2).toUpperCase()}
              </span>
            )}
            <span className={`absolute bottom-2 right-2 h-3.5 w-3.5 rounded-full border-2 border-white ${statusColorClass}`} />
          </div>
          <button
            type="button"
            onClick={() => void presenter.companionShellManager.open()}
            className="no-drag w-full rounded-xl px-1 text-center"
          >
            <div className="truncate text-[12px] font-semibold leading-4 text-slate-900">
              {bootstrapped ? view.title : "NextClaw"}
            </div>
            <div className="truncate pt-0.5 text-[11px] leading-4 text-slate-500">
              {bootstrapped ? view.subtitle : "Connecting"}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
