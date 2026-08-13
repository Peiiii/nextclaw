import { startOfMonth, toDayKey } from "@shared/utils/date.utils";
import type {
  CalendarEvent,
  CalendarSubscription,
  LoadStatus,
  ToastNotice,
} from "@shared/types/personal-organizer.types";
import { create, type StoreApi } from "zustand";

export interface CalendarState {
  month: Date;
  selectedDay: string;
  items: CalendarEvent[];
  subscriptions: CalendarSubscription[];
  status: LoadStatus;
  error: string;
  eventDialogOpen: boolean;
  eventDialogItemId: string | null;
  sourcesDialogOpen: boolean;
  eventPending: boolean;
  sourcePendingId: string | null;
  notice: ToastNotice | null;
  setMonth: (month: Date) => void;
  selectDay: (dayKey: string) => void;
  openEventDialog: (itemId?: string) => void;
  closeEventDialog: () => void;
  openSourcesDialog: () => void;
  closeSourcesDialog: () => void;
}

const today = new Date();

class CalendarStoreState implements CalendarState {
  month = startOfMonth(today);
  selectedDay = toDayKey(today);
  items: CalendarEvent[] = [];
  subscriptions: CalendarSubscription[] = [];
  status: LoadStatus = "idle";
  error = "";
  eventDialogOpen = false;
  eventDialogItemId: string | null = null;
  sourcesDialogOpen = false;
  eventPending = false;
  sourcePendingId: string | null = null;
  notice: ToastNotice | null = null;

  readonly #setState: StoreApi<CalendarState>["setState"];

  constructor(setState: StoreApi<CalendarState>["setState"]) {
    this.#setState = setState;
  }

  setMonth = (month: Date) => this.#setState({ month: startOfMonth(month) });

  selectDay = (selectedDay: string) => this.#setState({ selectedDay });

  openEventDialog = (itemId?: string) => this.#setState({
    eventDialogOpen: true,
    eventDialogItemId: itemId ?? null,
  });

  closeEventDialog = () => this.#setState({ eventDialogOpen: false, eventDialogItemId: null });

  openSourcesDialog = () => this.#setState({ sourcesDialogOpen: true });

  closeSourcesDialog = () => this.#setState({ sourcesDialogOpen: false });
}

export const useCalendarStore = create<CalendarState>((setState) => new CalendarStoreState(setState));
