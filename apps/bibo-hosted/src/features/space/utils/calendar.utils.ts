export type CalendarMode = "day" | "week" | "month";

export function calendarMonthDates(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  return Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, index) => new Date(first.getFullYear(), first.getMonth(), 1 - offset + index));
}

export function shiftCalendarDate(anchor: Date, mode: CalendarMode, step: number): Date {
  if (mode === "month") {
    const target = new Date(anchor.getFullYear(), anchor.getMonth() + step, 1);
    const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(anchor.getDate(), last));
    return target;
  }
  const target = new Date(anchor);
  target.setDate(target.getDate() + step * (mode === "week" ? 7 : 1));
  return target;
}

export function eventsOnDate<T extends { startAt: string; endAt: string }>(events: T[], date: Date): T[] {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
  return events.filter((event) => Date.parse(event.startAt) < end && Date.parse(event.endAt) > start).sort((a, b) => a.startAt.localeCompare(b.startAt));
}

export function calendarEventLayout<T extends { startAt: string; endAt: string }>(events: T[], date: Date) {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
  const result: Array<{ event: T; start: number; end: number; lane: number; lanes: number }> = [];
  let group: typeof result = [];
  let groupEnd = 0;
  let laneEnds: number[] = [];
  const finish = () => { for (const item of group) item.lanes = laneEnds.length; group = []; laneEnds = []; };
  for (const event of eventsOnDate(events, date)) {
    const start = Math.max(dayStart, Date.parse(event.startAt));
    const end = Math.min(dayEnd, Date.parse(event.endAt));
    if (start >= groupEnd) finish();
    let lane = laneEnds.findIndex((value) => value <= start);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = end; groupEnd = Math.max(groupEnd, end);
    const item = { event, start: (start - dayStart) / 60_000, end: (end - dayStart) / 60_000, lane, lanes: 1 };
    group.push(item); result.push(item);
  }
  finish();
  return result;
}
