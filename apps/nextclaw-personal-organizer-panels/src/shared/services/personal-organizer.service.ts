import type {
  CalendarEvent,
  CalendarEventDraft,
  CalendarSubscription,
  CalendarSyncResult,
  TodoDraft,
  TodoItem,
} from "@shared/types/personal-organizer.types";

const SERVICE_ID = "nextclaw-personal-organizer-data";

const requireRecord = (value: unknown, action: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${action} 返回了无法识别的数据。`);
  }
  return value as Record<string, unknown>;
};

const requireArray = <T>(value: unknown, action: string): T[] => {
  if (!Array.isArray(value)) {
    throw new Error(`${action} 返回了无法识别的数据。`);
  }
  return value as T[];
};

export class PersonalOrganizerService {
  invoke = async (action: string, input: Record<string, unknown> = {}): Promise<Record<string, unknown>> => {
    const bridge = window.nextclaw?.serviceActions;
    if (!bridge) {
      throw new Error("当前环境无法连接个人空间数据服务。");
    }
    const payload = await bridge.invoke(`${SERVICE_ID}.${action}`, input);
    return requireRecord(payload, action);
  };

  listTodos = async (): Promise<TodoItem[]> => {
    const payload = await this.invoke("todo_list", { status: "all" });
    return requireArray<TodoItem>(payload.items, "读取待办");
  };

  createTodo = async (draft: TodoDraft): Promise<TodoItem> => {
    const payload = await this.invoke("todo_create", { ...draft });
    return requireRecord(payload.item, "创建待办") as unknown as TodoItem;
  };

  updateTodo = async (id: string, input: Partial<TodoDraft> & { completed?: boolean }): Promise<TodoItem> => {
    const payload = await this.invoke("todo_update", { id, ...input });
    return requireRecord(payload.item, "更新待办") as unknown as TodoItem;
  };

  deleteTodo = async (id: string): Promise<void> => {
    await this.invoke("todo_delete", { id });
  };

  listEvents = async (start: string, end: string): Promise<{
    items: CalendarEvent[];
    subscriptions: CalendarSubscription[];
  }> => {
    const payload = await this.invoke("event_list", { start, end });
    return {
      items: requireArray<CalendarEvent>(payload.items, "读取日程"),
      subscriptions: requireArray<CalendarSubscription>(payload.subscriptions, "读取日历来源"),
    };
  };

  createEvent = async (draft: CalendarEventDraft): Promise<CalendarEvent> => {
    const payload = await this.invoke("event_create", { ...draft });
    return requireRecord(payload.item, "创建日程") as unknown as CalendarEvent;
  };

  updateEvent = async (id: string, draft: CalendarEventDraft): Promise<CalendarEvent> => {
    const payload = await this.invoke("event_update", { id, ...draft });
    return requireRecord(payload.item, "更新日程") as unknown as CalendarEvent;
  };

  deleteEvent = async (id: string): Promise<void> => {
    await this.invoke("event_delete", { id });
  };

  subscribeCalendar = async (name: string, url: string): Promise<{ synced: boolean; error: string }> => {
    const payload = await this.invoke("calendar_subscribe", { name, url });
    return {
      synced: payload.synced !== false,
      error: typeof payload.error === "string" ? payload.error : "",
    };
  };

  syncCalendars = async (id?: string): Promise<CalendarSyncResult[]> => {
    const payload = await this.invoke("calendar_sync", id ? { id } : {});
    return requireArray<CalendarSyncResult>(payload.results, "同步日历");
  };

  unsubscribeCalendar = async (id: string): Promise<void> => {
    await this.invoke("calendar_unsubscribe", { id });
  };
}

export const personalOrganizerService = new PersonalOrganizerService();
