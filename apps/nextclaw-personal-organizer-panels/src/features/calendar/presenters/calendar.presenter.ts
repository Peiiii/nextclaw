import { CalendarManager } from "@/features/calendar/managers/calendar.manager";
import { useCalendarStore } from "@/features/calendar/stores/calendar.store";

class CalendarPresenter {
  readonly manager = new CalendarManager(useCalendarStore);
}

export const calendarPresenter = new CalendarPresenter();
