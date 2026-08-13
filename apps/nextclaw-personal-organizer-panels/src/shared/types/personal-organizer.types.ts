export type TodoPriority = "low" | "normal" | "high";
export type LoadStatus = "idle" | "loading" | "ready" | "error";

export interface TodoItem {
  id: string;
  title: string;
  notes: string;
  dueDate: string;
  priority: TodoPriority;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TodoDraft {
  title: string;
  notes: string;
  dueDate: string;
  priority: TodoPriority;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location: string;
  notes: string;
  source: "local" | "ics";
  subscriptionId?: string;
  subscriptionName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CalendarEventDraft {
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location: string;
  notes: string;
}

export interface CalendarSubscription {
  id: string;
  name: string;
  url: string;
  lastSyncedAt: string;
  lastError: string;
}

export interface CalendarSyncResult {
  id: string;
  synced: boolean;
  error: string;
}

export interface ToastNotice {
  id: number;
  message: string;
  tone?: "default" | "error";
  action?: "undo-todo";
  itemId?: string;
}

export interface ServiceActionBridge {
  invoke(actionId: string, input?: Record<string, unknown>): Promise<unknown>;
}

declare global {
  interface Window {
    nextclaw?: {
      serviceActions?: ServiceActionBridge;
    };
  }
}
