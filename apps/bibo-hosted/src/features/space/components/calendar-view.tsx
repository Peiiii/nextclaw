import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { BiboEvent } from "@nextclaw/bibo-client";
import { Button, Dialog, EmptyState, IconButton, ListRow, SegmentedControl } from "@nextclaw/personal-agent-ui";
import { useBiboSpaceStore } from "@/features/space/stores/bibo-space.store";
import {
  calendarEventLayout,
  calendarMonthDates,
  eventsOnDate,
  shiftCalendarDate,
  type CalendarMode,
} from "@/features/space/utils/calendar.utils";

import { day, datetime } from "@/features/space/utils/date-format.utils";
import { EventForm } from "./event-form";
const time = (value: string) => new Date(value).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });

function CalendarTimeGrid({
  dates,
  activeDate,
  events,
  onSelect,
  onCreate,
}: {
  dates: Date[];
  activeDate: Date;
  events: BiboEvent[];
  onSelect: (id: string) => void;
  onCreate: (date: Date) => void;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const surface = scroll.current;
    if (!surface) return;
    const index = dates.findIndex((date) => date.toDateString() === activeDate.toDateString());
    const column = surface.querySelectorAll<HTMLElement>(".calendar-time-day")[Math.max(0, index)];
    const hourHeight = surface.querySelector(".calendar-hours span")?.getBoundingClientRect().height ?? 48;
    surface.scrollTo({ top: 8 * hourHeight, left: column ? Math.max(0, column.offsetLeft - surface.offsetLeft - 48) : 0 });
  }, [dates[0]?.toDateString(), activeDate.toDateString()]);
  return (
    <div className="calendar-time-scroll" ref={scroll} aria-label={dates.length === 1 ? "当日时间表" : "本周时间表"}>
      <div
        className="calendar-time-grid"
        style={{ gridTemplateColumns: `48px repeat(${dates.length}, minmax(110px, 1fr))` }}
      >
        <div className="calendar-time-heading">时间</div>
        {dates.map((date) => (
          <div className="calendar-time-heading" key={date.toISOString()}>
            {date.toLocaleDateString("zh-CN", { weekday: "short", day: "numeric" })}
          </div>
        ))}
        <div className="calendar-hours">
          {Array.from({ length: 24 }, (_, hour) => (
            <span key={hour}>{String(hour).padStart(2, "0")}:00</span>
          ))}
        </div>
        {dates.map((date) => (
          <div className="calendar-time-day" key={date.toISOString()}>
            {Array.from({ length: 48 }, (_, index) => (
              <button
                className="calendar-time-slot"
                key={index}
                aria-label={`${day(date.toISOString())} ${Math.floor(index / 2)}:${index % 2 ? "30" : "00"} 新建日程`}
                onClick={() => {
                  const slot = new Date(date);
                  slot.setHours(Math.floor(index / 2), index % 2 ? 30 : 0, 0, 0);
                  onCreate(slot);
                }}
              />
            ))}
            {calendarEventLayout(events, date).map(({ event, start, end, lane, lanes }) => (
              <button
                className="calendar-time-event"
                key={event.id}
                title={`${time(event.startAt)}–${time(event.endAt)} ${event.title}`}
                style={{
                  top: `calc(${start} * var(--calendar-minute-height))`,
                  height: `max(22px, calc(${end - start} * var(--calendar-minute-height) - 2px))`,
                  left: `calc(${(lane / lanes) * 100}% + 2px)`,
                  width: `calc(${100 / lanes}% - 4px)`,
                }}
                onClick={() => onSelect(event.id)}
              >
                <strong>{event.title}</strong>
                <small>
                  {time(event.startAt)}–{time(event.endAt)}
                </small>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
function CalendarMonthGrid({ onSelect, onCreate }: { onSelect: () => void; onCreate: (date: Date) => void }) {
  const { events, calendarDate: anchor, setCalendarDate: setAnchor, selectEvent } = useBiboSpaceStore();
  const today = new Date();
  return (
    <div className="calendar-month" aria-label="月历">
      <div className="calendar-weekdays">
        {["一", "二", "三", "四", "五", "六", "日"].map((label) => (
          <span key={label}>周{label}</span>
        ))}
      </div>
      <div className="calendar-month-grid">
        {calendarMonthDates(anchor).map((date) => {
          const items = eventsOnDate(events, date);
          return (
            <div
              key={date.toISOString()}
              data-count={items.length || undefined}
              className={`calendar-date${date.getMonth() !== anchor.getMonth() ? " is-outside" : ""}${isSameDay(date, anchor) ? " is-selected" : ""}${isSameDay(date, today) ? " is-today" : ""}`}
            >
              <button
                className="calendar-date-select"
                aria-label={`${day(date.toISOString())}，${items.length} 项安排`}
                aria-pressed={isSameDay(date, anchor)}
                onDoubleClick={() => { const start = new Date(date); start.setHours(9, 0, 0, 0); onCreate(start); }}
                onClick={() => {
                  setAnchor(date);
                  selectEvent(null);
                  onSelect();
                }}
              >
                <span>{date.getDate()}</span>
              </button>
              <div className="calendar-date-events">
                {items.slice(0, 3).map((event) => (
                  <button
                    key={event.id}
                    title={`${time(event.startAt)} ${event.title}`}
                    onClick={() => {
                      selectEvent(event.id);
                      onSelect();
                    }}
                  >
                    <time>{isSameDay(new Date(event.startAt), date) ? time(event.startAt) : "跨日"}</time>
                    <span>{event.title}</span>
                  </button>
                ))}
                {items.length > 3 && (
                  <button
                    className="calendar-overflow"
                    onClick={() => {
                      setAnchor(date);
                      selectEvent(null);
                      onSelect();
                    }}
                  >
                    还有 {items.length - 3} 项
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function CalendarAgenda({ onSelect, onCreate }: { onSelect: () => void; onCreate: () => void }) {
  const {
    events,
    selectedEventId,
    calendarDate: anchor,
    setCalendarDate: setAnchor,
    selectEvent,
  } = useBiboSpaceStore();
  const selectedEvents = eventsOnDate(events, anchor);
  const dayStart = new Date(anchor);
  dayStart.setHours(0, 0, 0, 0);
  const nextDay = new Date(dayStart);
  nextDay.setDate(nextDay.getDate() + 1);
  const upcoming = events
    .filter((event) => new Date(event.startAt).getTime() >= nextDay.getTime())
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .slice(0, 4);
  return (
    <div className="bibo-list-pane bibo-day-agenda">
      <div className="bibo-agenda-heading">
        <div>
          <h2>{day(anchor.toISOString())}</h2>
        </div>
        <span>{selectedEvents.length} 项安排</span>
        <IconButton label="在这一天新建日程" icon={<Plus />} onClick={onCreate} />
      </div>
      {selectedEvents.length ? (
        <div className="bibo-agenda-items">
          {selectedEvents.map((event) => (
            <ListRow
              className="bibo-agenda-event"
              selected={selectedEventId === event.id}
              key={event.id}
              onClick={() => {
                selectEvent(event.id);
                onSelect();
              }}
            >
              <span>
                {time(event.startAt)}
                <small>{time(event.endAt)}</small>
              </span>
              <div>
                <strong>{event.title}</strong>
                {event.description && <small>{event.description}</small>}
              </div>
            </ListRow>
          ))}
        </div>
      ) : (
        <div className="bibo-agenda-empty">
          <strong>这一天还没有安排。</strong>
        </div>
      )}
      {upcoming.length > 0 && (
        <div className="bibo-upcoming">
          <span className="bibo-kicker">接下来</span>
          {upcoming.map((event) => (
            <button
              key={event.id}
              onClick={() => {
                setAnchor(new Date(event.startAt));
                selectEvent(event.id);
                onSelect();
              }}
            >
              <span>{datetime(event.startAt)}</span>
              <strong>{event.title}</strong>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CalendarView() {
  const {
    events,
    selectedEventId,
    selectEvent,
    calendarDate: anchor,
    setCalendarDate: setAnchor,
    readStatus,
    error,
    load,
    saving,
  } = useBiboSpaceStore();
  const [mode, setMode] = useState<CalendarMode>("month");
  const [creating, setCreating] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [slot, setSlot] = useState<Date | null>(null);
  const selected = events.find((event) => event.id === selectedEventId) ?? null;
  const dates = Array.from(
    { length: 7 },
    (_, index) =>
      new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - ((anchor.getDay() + 6) % 7) + index),
  );
  const closeDetails = () => {
    setCreating(false);
    setDetailsOpen(false);
    selectEvent(null);
  };
  const create = (date?: Date) => {
    setSlot(date ?? null);
    if (date) setAnchor(date);
    selectEvent(null);
    setCreating(true);
    setDetailsOpen(true);
  };
  const select = (id: string) => {
    selectEvent(id);
    setCreating(false);
    setDetailsOpen(true);
  };
  const move = (step: number) => {
    setAnchor(shiftCalendarDate(anchor, mode, step));
    closeDetails();
  };
  const status = readStatus.calendar ?? "loading";
  return (
    <div className="bibo-page workspace-page calendar-page">
      <div className="bibo-filterbar workspace-toolbar bibo-calendar-controls">
        <div className="calendar-period">
          <strong>{anchor.toLocaleDateString("zh-CN", { year: "numeric", month: "long" })}</strong>
          <IconButton label="上一段时间" icon={<ChevronLeft />} onClick={() => move(-1)} />
          <IconButton label="下一段时间" icon={<ChevronRight />} onClick={() => move(1)} />
        </div>
        <Button
          tone="text"
          onClick={() => {
            setAnchor(new Date());
            closeDetails();
          }}
        >
          今天
        </Button>
        <span className="bibo-filter-spacer" />
        <SegmentedControl
          label="日程视图"
          value={mode}
          options={[
            { value: "day", label: "日" },
            { value: "week", label: "周" },
            { value: "month", label: "月" },
          ]}
          onChange={(value) => {
            setMode(value);
            closeDetails();
          }}
        />
        <Button tone="primary" onClick={() => create()}>
          ＋ 新日程
        </Button>
      </div>
      {status !== "ready" ? <div className="bibo-read-state" role={status === "error" ? "alert" : "status"}>
        <EmptyState title={status === "error" ? "暂时无法读取日程" : "正在读取日程"} detail={status === "error" ? error || "请检查连接后重试。" : undefined} />
        {status === "error" && <Button tone="secondary" onClick={() => void load("calendar")}>重试读取</Button>}
      </div> : <div className={`calendar-stage${detailsOpen && !creating && !selected ? " is-detail-open" : ""}`}>
        <div className="calendar-surface">
          {mode === "month" ? (
            <CalendarMonthGrid
              onCreate={create}
              onSelect={() => {
                setCreating(false);
                setDetailsOpen(Boolean(useBiboSpaceStore.getState().selectedEventId));
              }}
            />
          ) : (
            <CalendarTimeGrid
              dates={mode === "week" ? dates : [anchor]}
              activeDate={anchor}
              events={events}
              onSelect={select}
              onCreate={create}
            />
          )}
          {mode === "month" ? <div className="calendar-mobile-agenda"><CalendarAgenda onSelect={() => setDetailsOpen(true)} onCreate={() => create()} /></div>
            : <Button className="calendar-mobile-day" tone="text" onClick={() => setDetailsOpen(true)}>
              {day(anchor.toISOString())} · {eventsOnDate(events, anchor).length} 项安排 ›
            </Button>}
        </div>
        <aside className="calendar-inspector" aria-label="日程详情">
          <Button className="calendar-mobile-back" tone="text" onClick={closeDetails}>
            ← 返回{mode === "month" ? "月历" : "时间表"}
          </Button>
            <CalendarAgenda
              onSelect={() => {
                setCreating(false);
                setDetailsOpen(true);
              }}
              onCreate={() => create()}
            />
        </aside>
      </div>}
      <Dialog open={creating || Boolean(selected)} title={selected ? "编辑日程" : "新日程"} closeLabel="关闭日程编辑" busy={saving}
        onOpenChange={(open) => { if (!open) closeDetails(); }}>
        {(creating || selected) && <EventForm key={selected?.id ?? `new-${slot?.toISOString() ?? anchor.toDateString()}`}
          event={selected} date={anchor} slot={slot} onDone={closeDetails} />}
      </Dialog>
    </div>
  );
}
