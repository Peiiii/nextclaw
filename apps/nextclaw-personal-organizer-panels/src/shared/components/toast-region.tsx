import type { ToastNotice } from "@shared/types/personal-organizer.types";

interface ToastRegionProps {
  notice: ToastNotice | null;
  onAction?: () => void;
}

export function ToastRegion({ notice, onAction }: ToastRegionProps) {
  if (!notice) return null;
  return (
    <div
      role={notice.tone === "error" ? "alert" : "status"}
      className={`fixed bottom-5 left-1/2 z-50 flex w-[min(420px,calc(100vw-28px))] -translate-x-1/2 items-center justify-between gap-4 rounded-2xl px-4 py-3 text-sm shadow-2xl ${notice.tone === "error" ? "bg-[var(--danger)] text-white" : "bg-[var(--text)] text-[var(--canvas)]"}`}
    >
      <span className="min-w-0 leading-5">{notice.message}</span>
      {notice.action && onAction ? (
        <button type="button" className="focus-ring shrink-0 rounded-lg px-2 py-1 font-semibold hover:bg-white/10" onClick={onAction}>
          撤销
        </button>
      ) : null}
    </div>
  );
}
