import assert from "node:assert/strict";
import test from "node:test";
import { calendarEventLayout, calendarMonthDates, calendarMonthRange, eventsOnDate, shiftCalendarDate } from "./calendar.utils";

test("month navigation clamps the day through leap February and year boundaries", () => {
  const leap = shiftCalendarDate(new Date(2024, 0, 31), "month", 1);
  assert.equal(leap.getMonth(), 1);
  assert.equal(leap.getDate(), 29);
  const year = shiftCalendarDate(new Date(2026, 11, 31), "month", 1);
  assert.equal(year.getFullYear(), 2027);
  assert.equal(year.getMonth(), 0);
  assert.equal(year.getDate(), 31);
});

test("month grid covers every date and complete Monday-to-Sunday weeks", () => {
  for (let month = 0; month < 12; month += 1) {
    const dates = calendarMonthDates(new Date(2026, month, 15));
    assert.equal(dates[0]!.getDay(), 1);
    assert.equal(dates.at(-1)!.getDay(), 0);
    assert.equal(dates.length % 7, 0);
    assert.equal(dates.filter((date) => date.getMonth() === month).length, new Date(2026, month + 1, 0).getDate());
  }
});

test("month request range includes complete visible weeks without the next midnight", () => {
  const range = calendarMonthRange(new Date(2026, 8, 25));
  assert.equal(range.from, new Date(2026, 7, 31).toISOString());
  assert.equal(range.to, new Date(2026, 9, 4, 23, 59, 59, 999).toISOString());
});

test("cross-day events appear on every occupied date but exclude their midnight end", () => {
  const event = { startAt: new Date(2026, 8, 25, 22).toISOString(), endAt: new Date(2026, 8, 27, 0).toISOString() };
  assert.equal(eventsOnDate([event], new Date(2026, 8, 25)).length, 1);
  assert.equal(eventsOnDate([event], new Date(2026, 8, 26)).length, 1);
  assert.equal(eventsOnDate([event], new Date(2026, 8, 27)).length, 0);
});

test("time grid separates overlapping events and reuses lanes after an event ends", () => {
  const date = new Date(2026, 8, 25);
  const at = (hour: number) => new Date(2026, 8, 25, hour).toISOString();
  const items = calendarEventLayout([{ startAt: at(9), endAt: at(11) }, { startAt: at(10), endAt: at(12) }, { startAt: at(11), endAt: at(13) }, { startAt: at(14), endAt: at(15) }], date);
  assert.deepEqual(items.map(({ lane, lanes }) => [lane, lanes]), [[0, 2], [1, 2], [0, 2], [0, 1]]);
  assert.equal(items[0]?.start, 540);
});
