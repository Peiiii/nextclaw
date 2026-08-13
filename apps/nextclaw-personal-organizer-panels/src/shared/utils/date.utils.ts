import type { CalendarEvent, TodoItem } from "@shared/types/personal-organizer.types";

const pad = (value: number): string => String(value).padStart(2, "0");

export const toDayKey = (value: Date | string): string => {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const fromDayKey = (value: string): Date => new Date(`${value}T00:00:00`);

export const startOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);

export const addMonths = (date: Date, amount: number): Date =>
  new Date(date.getFullYear(), date.getMonth() + amount, 1);

export const addDays = (date: Date, amount: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

export const getCalendarGridRange = (month: Date): { start: Date; end: Date; days: Date[] } => {
  const start = startOfMonth(month);
  const mondayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayOffset);
  start.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 42 }, (_, index) => addDays(start, index));
  const end = addDays(start, 42);
  return { start, end, days };
};

export const toLocalDateTimeValue = (value: string | Date): string => {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${toDayKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const toLocalDateValue = (value: string | Date): string =>
  toDayKey(typeof value === "string" ? new Date(value) : value);

export const eventOccursOnDay = (event: CalendarEvent, dayKey: string): boolean => {
  const dayStart = fromDayKey(dayKey).getTime();
  const dayEnd = addDays(fromDayKey(dayKey), 1).getTime();
  const eventStart = new Date(event.start).getTime();
  const rawEnd = new Date(event.end || event.start).getTime();
  const eventEnd = Math.max(rawEnd, eventStart + 1);
  return eventStart < dayEnd && eventEnd > dayStart;
};

export type TodoGroupKey = "overdue" | "today" | "upcoming" | "anytime" | "completed";

export const getTodoGroup = (item: TodoItem, now = new Date()): TodoGroupKey => {
  if (item.completed) return "completed";
  if (!item.dueDate) return "anytime";
  const due = new Date(item.dueDate);
  const today = toDayKey(now);
  const dueDay = toDayKey(due);
  if (due.getTime() < now.getTime() && dueDay !== today) return "overdue";
  if (dueDay === today) return "today";
  return "upcoming";
};

export const formatTodoDue = (value: string, now = new Date()): string => {
  if (!value) return "";
  const date = new Date(value);
  const today = toDayKey(now);
  const tomorrow = toDayKey(addDays(now, 1));
  const dateLabel = toDayKey(date) === today ? "今天" : toDayKey(date) === tomorrow ? "明天" :
    new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", weekday: "short" }).format(date);
  return `${dateLabel} ${new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date)}`;
};

export const formatEventTime = (event: CalendarEvent): string => {
  const start = new Date(event.start);
  if (event.allDay) return "全天";
  const startText = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(start);
  const end = event.end ? new Date(event.end) : null;
  if (!end || toDayKey(start) !== toDayKey(end)) return startText;
  const endText = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(end);
  return `${startText}–${endText}`;
};

export const formatSelectedDay = (dayKey: string): string =>
  new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(fromDayKey(dayKey));

export const createDefaultEventTimes = (dayKey: string, now = new Date()): { start: string; end: string } => {
  const isToday = dayKey === toDayKey(now);
  const start = fromDayKey(dayKey);
  if (isToday) {
    start.setHours(Math.min(now.getHours() + 1, 23), 0, 0, 0);
  } else {
    start.setHours(9, 0, 0, 0);
  }
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { start: toLocalDateTimeValue(start), end: toLocalDateTimeValue(end) };
};
