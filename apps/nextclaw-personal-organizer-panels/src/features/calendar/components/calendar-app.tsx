import { CalendarDays, Link2, Plus } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@shared/components/button";
import { ToastRegion } from "@shared/components/toast-region";
import { calendarPresenter } from "@/features/calendar/presenters/calendar.presenter";
import { useCalendarStore } from "@/features/calendar/stores/calendar.store";
import { CalendarSourcesDialog } from "./calendar-sources-dialog";
import { DayAgenda } from "./day-agenda";
import { EventEditor } from "./event-editor";
import { MonthGrid } from "./month-grid";

export function CalendarApp() {
  const subscriptions = useCalendarStore((state) => state.subscriptions);
  const notice = useCalendarStore((state) => state.notice);
  const openEventDialog = useCalendarStore((state) => state.openEventDialog);
  const openSourcesDialog = useCalendarStore((state) => state.openSourcesDialog);
  const eventDialogOpen = useCalendarStore((state) => state.eventDialogOpen);
  const eventDialogItemId = useCalendarStore((state) => state.eventDialogItemId);
  const selectedDay = useCalendarStore((state) => state.selectedDay);

  useEffect(() => { void calendarPresenter.manager.load(); }, []);

  return (
    <main className="panel-shell">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--text)] text-[var(--canvas)]"><CalendarDays size={21} /></span>
          <div className="min-w-0"><h1 className="text-[28px] font-semibold tracking-[-0.035em]">日历</h1><p className="mt-0.5 text-sm text-[var(--muted)]">安排自己的时间，也看见已有日历</p></div>
        </div>
        <div className="flex items-center gap-2">
          <Button tone="secondary" icon={<Link2 size={15} />} className="px-3" onClick={openSourcesDialog}><span>来源</span>{subscriptions.length ? <span className="rounded-md bg-[var(--surface-strong)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">{subscriptions.length}</span> : null}</Button>
          <Button tone="primary" icon={<Plus size={16} />} onClick={() => openEventDialog()}>新日程</Button>
        </div>
      </header>
      <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_280px] lg:grid-cols-[minmax(0,1fr)_300px]">
        <MonthGrid />
        <DayAgenda />
      </div>
      <EventEditor key={`${eventDialogOpen ? "open" : "closed"}:${eventDialogItemId ?? "new"}:${selectedDay}`} />
      <CalendarSourcesDialog />
      <ToastRegion notice={notice} />
    </main>
  );
}
