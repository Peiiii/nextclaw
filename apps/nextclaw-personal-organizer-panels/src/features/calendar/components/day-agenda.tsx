import { CalendarPlus, Clock3, MapPin, Plus } from "lucide-react";
import { Button } from "@shared/components/button";
import { StatusView } from "@shared/components/status-view";
import { eventOccursOnDay, formatEventTime, formatSelectedDay } from "@shared/utils/date.utils";
import { useCalendarStore } from "@/features/calendar/stores/calendar.store";

export function DayAgenda() {
  const { selectedDay, items, status, openEventDialog } = useCalendarStore();
  const dayItems = items.filter((item) => eventOccursOnDay(item, selectedDay));
  const title = formatSelectedDay(selectedDay);

  return (
    <aside className="panel-surface self-start overflow-hidden" aria-label={`${title}的日程`}>
      <header className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-4">
        <div className="min-w-0"><p className="text-xs font-medium text-[var(--muted)]">所选日期</p><h2 className="mt-1 text-[16px] font-semibold tracking-[-0.02em]">{title}</h2></div>
        <Button tone="secondary" icon={<Plus size={15} />} className="min-h-9 px-2.5 text-xs" onClick={() => openEventDialog()}>日程</Button>
      </header>
      {status === "loading" || status === "idle" ? (
        <StatusView kind="loading" title="正在整理这一天" />
      ) : status === "error" ? (
        <StatusView kind="error" title="日程详情暂不可用" description="重新加载日历后，这里的安排会一并恢复。" />
      ) : dayItems.length === 0 ? (
        <StatusView kind="empty" title="这一天还没有安排" description="在这里留出时间，或从已有日历同步进来。" actionLabel="添加日程" onAction={() => openEventDialog()} />
      ) : (
        <div className="divide-y divide-[var(--line)]">
          {dayItems.map((item) => (
            <button key={item.id} type="button" className="focus-ring group flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-[var(--surface-muted)]" onClick={() => openEventDialog(item.id)}>
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.source === "ics" ? "bg-[var(--external)]" : "bg-[var(--success)]"}`} />
              <span className="min-w-0 flex-1">
                <span className="block break-words text-sm font-medium leading-5">{item.title}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted)]"><span className="inline-flex items-center gap-1"><Clock3 size={12} />{formatEventTime(item)}</span>{item.location ? <span className="inline-flex items-center gap-1"><MapPin size={12} />{item.location}</span> : null}</span>
                {item.source === "ics" ? <span className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-[var(--external-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--external)]">{item.subscriptionName || "外部日历"}</span> : null}
              </span>
            </button>
          ))}
        </div>
      )}
      {status === "ready" && dayItems.length > 0 ? (
        <div className="border-t border-[var(--line)] p-3"><Button tone="ghost" icon={<CalendarPlus size={15} />} className="w-full text-xs" onClick={() => openEventDialog()}>在这一天添加日程</Button></div>
      ) : null}
    </aside>
  );
}
