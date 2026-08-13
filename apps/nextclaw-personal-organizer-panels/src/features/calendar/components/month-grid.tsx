import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarEvent } from "@shared/types/personal-organizer.types";
import { eventOccursOnDay, getCalendarGridRange, toDayKey } from "@shared/utils/date.utils";
import { Button } from "@shared/components/button";
import { IconButton } from "@shared/components/icon-button";
import { StatusView } from "@shared/components/status-view";
import { calendarPresenter } from "@/features/calendar/presenters/calendar.presenter";
import { useCalendarStore } from "@/features/calendar/stores/calendar.store";

const weekdays = ["一", "二", "三", "四", "五", "六", "日"];

function DayCell({
  date,
  month,
  selectedDay,
  items,
}: {
  date: Date;
  month: Date;
  selectedDay: string;
  items: CalendarEvent[];
}) {
  const key = toDayKey(date);
  const isToday = key === toDayKey(new Date());
  const selected = key === selectedDay;
  const outside = date.getMonth() !== month.getMonth();
  const dayItems = items.filter((item) => eventOccursOnDay(item, key));
  const label = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(date);

  return (
    <div className={`relative min-h-[92px] border-b border-r border-[var(--line)] p-1.5 last:border-r-0 sm:min-h-[106px] ${outside ? "bg-[var(--surface-muted)]/45" : "bg-[var(--surface)]"} ${selected ? "bg-[var(--surface-muted)] shadow-[inset_0_0_0_1px_var(--line-strong)]" : ""}`}>
      <button
        type="button"
        aria-label={`选择${label}${dayItems.length ? `，${dayItems.length} 个日程` : ""}`}
        aria-pressed={selected}
        className="focus-ring relative z-[1] flex w-full items-center justify-between rounded-md"
        onClick={() => void calendarPresenter.manager.selectDay(key)}
      >
        <span className={`grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs ${isToday ? "bg-[var(--text)] font-semibold text-[var(--canvas)]" : selected ? "font-semibold text-[var(--text)]" : outside ? "text-[var(--faint)]" : "text-[var(--muted)]"}`}>{date.getDate()}</span>
        {dayItems.length > 3 ? <span className="text-[10px] text-[var(--faint)]">+{dayItems.length - 3}</span> : null}
      </button>
      <div className="relative z-[2] mt-1 space-y-1">
        {dayItems.slice(0, 3).map((item) => (
          <button
            key={item.id}
            type="button"
            aria-label={`打开日程：${item.title}`}
            className={`focus-ring flex h-4 w-full items-center rounded-md px-1.5 text-left text-[10px] font-medium leading-4 transition sm:h-auto sm:py-1 sm:text-[11px] ${item.source === "ics" ? "bg-[var(--external-soft)] text-[var(--external)] hover:brightness-95" : "bg-[var(--success-soft)] text-[var(--success)] hover:brightness-95"}`}
            title={item.title}
            onClick={() => useCalendarStore.getState().openEventDialog(item.id)}
          >
            <span className="mx-auto h-1.5 w-1.5 rounded-full bg-current sm:hidden" aria-hidden="true" />
            <span className="hidden truncate sm:block">{item.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function MonthGrid() {
  const { month, selectedDay, items, status, error } = useCalendarStore();
  const range = getCalendarGridRange(month);
  const monthLabel = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long" }).format(month);

  return (
    <section className="panel-surface min-w-0 overflow-hidden" aria-label={monthLabel}>
      <header className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-3 sm:px-4">
        <div className="flex items-center gap-1">
          <IconButton label="上个月" onClick={() => void calendarPresenter.manager.changeMonth(-1)}><ChevronLeft size={17} /></IconButton>
          <IconButton label="下个月" onClick={() => void calendarPresenter.manager.changeMonth(1)}><ChevronRight size={17} /></IconButton>
        </div>
        <h2 className="min-w-0 truncate text-[15px] font-semibold tracking-[-0.015em]">{monthLabel}</h2>
        <Button tone="ghost" className="min-h-9 px-2.5 text-xs" onClick={() => void calendarPresenter.manager.goToToday()}>今天</Button>
      </header>
      <div className="grid grid-cols-7 border-b border-[var(--line)] bg-[var(--surface-muted)]/55">
        {weekdays.map((weekday, index) => <div key={weekday} className={`py-2 text-center text-[10px] font-semibold ${index > 4 ? "text-[var(--faint)]" : "text-[var(--muted)]"}`}>{weekday}</div>)}
      </div>
      {status === "loading" || status === "idle" ? <StatusView kind="loading" title="正在加载日历" /> : status === "error" ? <StatusView kind="error" title="暂时无法读取日历" description={error} actionLabel="重新加载" onAction={() => void calendarPresenter.manager.load()} /> : (
        <div className="grid grid-cols-7 [&>*:nth-child(7n)]:border-r-0 [&>*:nth-last-child(-n+7)]:border-b-0">
          {range.days.map((date) => <DayCell key={date.toISOString()} date={date} month={month} selectedDay={selectedDay} items={items} />)}
        </div>
      )}
    </section>
  );
}
