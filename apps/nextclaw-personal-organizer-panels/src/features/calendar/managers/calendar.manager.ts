import { personalOrganizerService } from "@shared/services/personal-organizer.service";
import type { CalendarEvent, CalendarEventDraft } from "@shared/types/personal-organizer.types";
import {
  addMonths,
  fromDayKey,
  getCalendarGridRange,
  startOfMonth,
  toDayKey,
} from "@shared/utils/date.utils";
import type { StoreApi } from "zustand";
import type { CalendarState } from "@/features/calendar/stores/calendar.store";

const sortEvents = (items: CalendarEvent[]): CalendarEvent[] =>
  [...items].sort((left, right) => left.start.localeCompare(right.start) || left.title.localeCompare(right.title));

export class CalendarManager {
  constructor(private readonly store: StoreApi<CalendarState>) {}

  load = async (): Promise<void> => {
    const { month } = this.store.getState();
    const range = getCalendarGridRange(month);
    this.store.setState({ status: "loading", error: "" });
    try {
      const payload = await personalOrganizerService.listEvents(range.start.toISOString(), range.end.toISOString());
      this.store.setState({
        items: sortEvents(payload.items),
        subscriptions: payload.subscriptions,
        status: "ready",
      });
    } catch (error) {
      this.store.setState({
        status: "error",
        error: error instanceof Error ? error.message : "暂时无法读取日历。",
      });
    }
  };

  changeMonth = async (amount: number): Promise<void> => {
    const month = addMonths(this.store.getState().month, amount);
    this.store.setState({ month, selectedDay: toDayKey(month) });
    await this.load();
  };

  goToToday = async (): Promise<void> => {
    const today = new Date();
    this.store.setState({ month: startOfMonth(today), selectedDay: toDayKey(today) });
    await this.load();
  };

  selectDay = async (dayKey: string): Promise<void> => {
    const selected = fromDayKey(dayKey);
    const currentMonth = this.store.getState().month;
    const changes: Partial<CalendarState> = { selectedDay: dayKey };
    if (selected.getMonth() !== currentMonth.getMonth() || selected.getFullYear() !== currentMonth.getFullYear()) {
      changes.month = startOfMonth(selected);
    }
    this.store.setState(changes);
    if (changes.month) await this.load();
  };

  saveEvent = async (draft: CalendarEventDraft, itemId?: string): Promise<boolean> => {
    if (this.store.getState().eventPending) return false;
    const start = new Date(draft.start).getTime();
    const end = new Date(draft.end).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      this.showError("请填写有效的开始和结束时间。");
      return false;
    }
    if (end < start || (!draft.allDay && end === start)) {
      this.showError("结束时间需要晚于开始时间。");
      return false;
    }
    this.store.setState({ eventPending: true });
    try {
      const item = itemId
        ? await personalOrganizerService.updateEvent(itemId, draft)
        : await personalOrganizerService.createEvent(draft);
      this.store.setState((state) => ({
        items: sortEvents(itemId
          ? state.items.map((entry) => entry.id === item.id ? item : entry)
          : [...state.items, item]),
        eventPending: false,
        eventDialogOpen: false,
        eventDialogItemId: null,
        selectedDay: toDayKey(item.start),
        notice: { id: Date.now(), message: itemId ? "日程已更新" : "日程已添加" },
      }));
      this.dismissNoticeLater();
      return true;
    } catch (error) {
      this.store.setState({ eventPending: false });
      this.showError(error instanceof Error ? error.message : "没有保存成功，请再试一次。");
      return false;
    }
  };

  deleteEvent = async (itemId: string): Promise<boolean> => {
    if (this.store.getState().eventPending) return false;
    this.store.setState({ eventPending: true });
    try {
      await personalOrganizerService.deleteEvent(itemId);
      this.store.setState((state) => ({
        items: state.items.filter((item) => item.id !== itemId),
        eventPending: false,
        eventDialogOpen: false,
        eventDialogItemId: null,
        notice: { id: Date.now(), message: "日程已删除" },
      }));
      this.dismissNoticeLater();
      return true;
    } catch (error) {
      this.store.setState({ eventPending: false });
      this.showError(error instanceof Error ? error.message : "没有删除成功，请再试一次。");
      return false;
    }
  };

  subscribe = async (name: string, url: string): Promise<boolean> => {
    if (this.store.getState().sourcePendingId) return false;
    this.store.setState({ sourcePendingId: "new" });
    try {
      const result = await personalOrganizerService.subscribeCalendar(name, url);
      await this.load();
      this.store.setState({
        sourcePendingId: null,
        notice: {
          id: Date.now(),
          message: result.synced ? "日历已连接并同步" : "日历已连接；首次同步失败，可稍后重试",
          tone: result.synced ? "default" : "error",
        },
      });
      this.dismissNoticeLater(result.synced ? 3_000 : 6_000);
      return true;
    } catch (error) {
      this.store.setState({ sourcePendingId: null });
      this.showError(error instanceof Error ? error.message : "没有连接成功，请检查链接。",
      );
      return false;
    }
  };

  sync = async (id?: string): Promise<void> => {
    if (this.store.getState().sourcePendingId) return;
    this.store.setState({ sourcePendingId: id ?? "all" });
    try {
      const results = await personalOrganizerService.syncCalendars(id);
      await this.load();
      const failures = results.filter((result) => !result.synced);
      this.store.setState({
        sourcePendingId: null,
        notice: {
          id: Date.now(),
          message: failures.length ? `${results.length - failures.length} 个日历已同步，${failures.length} 个失败` : "日历已同步",
          tone: failures.length ? "error" : "default",
        },
      });
      this.dismissNoticeLater(failures.length ? 6_000 : 3_000);
    } catch (error) {
      await this.load();
      this.store.setState({ sourcePendingId: null });
      this.showError(error instanceof Error ? error.message : "同步失败，请稍后重试。");
    }
  };

  unsubscribe = async (id: string): Promise<boolean> => {
    if (this.store.getState().sourcePendingId) return false;
    this.store.setState({ sourcePendingId: id });
    try {
      await personalOrganizerService.unsubscribeCalendar(id);
      await this.load();
      this.store.setState({
        sourcePendingId: null,
        notice: { id: Date.now(), message: "日历来源已移除" },
      });
      this.dismissNoticeLater();
      return true;
    } catch (error) {
      this.store.setState({ sourcePendingId: null });
      this.showError(error instanceof Error ? error.message : "没有移除成功，请重试。");
      return false;
    }
  };

  private showError = (message: string): void => {
    this.store.setState({ notice: { id: Date.now(), message, tone: "error" } });
    this.dismissNoticeLater(5_000);
  };

  private dismissNoticeLater = (delay = 3_000): void => {
    const noticeId = this.store.getState().notice?.id;
    window.setTimeout(() => {
      if (this.store.getState().notice?.id === noticeId) this.store.setState({ notice: null });
    }, delay);
  };
}
