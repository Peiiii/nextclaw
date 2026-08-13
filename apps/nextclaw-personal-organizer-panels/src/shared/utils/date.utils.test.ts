import { describe, expect, it } from "vitest";
import type { CalendarEvent, TodoItem } from "@shared/types/personal-organizer.types";
import {
  createDefaultEventTimes,
  eventOccursOnDay,
  getCalendarGridRange,
  getTodoGroup,
  toDayKey,
} from "./date.utils";

const todo = (input: Partial<TodoItem> = {}): TodoItem => ({
  id: "todo-1",
  title: "验证待办",
  notes: "",
  dueDate: "",
  priority: "normal",
  completed: false,
  createdAt: "2026-08-13T01:00:00.000Z",
  updatedAt: "2026-08-13T01:00:00.000Z",
  ...input,
});

const calendarEvent = (input: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: "event-1",
  title: "验证日程",
  start: "2026-08-13T09:00:00+08:00",
  end: "2026-08-13T10:00:00+08:00",
  allDay: false,
  location: "",
  notes: "",
  source: "local",
  ...input,
});

describe("personal organizer date semantics", () => {
  it("groups open todos by user-visible day instead of timestamp alone", () => {
    const now = new Date("2026-08-13T12:00:00+08:00");

    expect(getTodoGroup(todo({ dueDate: "2026-08-13T09:00:00+08:00" }), now)).toBe("today");
    expect(getTodoGroup(todo({ dueDate: "2026-08-12T23:00:00+08:00" }), now)).toBe("overdue");
    expect(getTodoGroup(todo({ dueDate: "2026-08-14T09:00:00+08:00" }), now)).toBe("upcoming");
    expect(getTodoGroup(todo(), now)).toBe("anytime");
    expect(getTodoGroup(todo({ completed: true }), now)).toBe("completed");
  });

  it("shows an event on every local day it overlaps", () => {
    const event = calendarEvent({
      start: "2026-08-13T23:30:00+08:00",
      end: "2026-08-14T01:00:00+08:00",
    });

    expect(eventOccursOnDay(event, "2026-08-13")).toBe(true);
    expect(eventOccursOnDay(event, "2026-08-14")).toBe(true);
    expect(eventOccursOnDay(event, "2026-08-15")).toBe(false);
  });

  it("builds a stable six-week month grid from Monday", () => {
    const range = getCalendarGridRange(new Date("2026-08-13T12:00:00+08:00"));

    expect(range.days).toHaveLength(42);
    expect(range.start.getDay()).toBe(1);
    expect(toDayKey(range.end)).toBe(toDayKey(new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate() + 42)));
  });

  it("uses the next full hour today and 09:00 for a future day", () => {
    const now = new Date("2026-08-13T10:34:00+08:00");

    expect(createDefaultEventTimes("2026-08-13", now)).toEqual({ start: "2026-08-13T11:00", end: "2026-08-13T12:00" });
    expect(createDefaultEventTimes("2026-08-14", now)).toEqual({ start: "2026-08-14T09:00", end: "2026-08-14T10:00" });
  });
});
