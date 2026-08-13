import type { LoadStatus, ToastNotice, TodoItem } from "@shared/types/personal-organizer.types";
import { create, type StoreApi } from "zustand";

export type TodoFilter = "open" | "completed";

export interface TodoState {
  items: TodoItem[];
  status: LoadStatus;
  error: string;
  filter: TodoFilter;
  editorOpen: boolean;
  editorItemId: string | null;
  pendingIds: string[];
  quickPending: boolean;
  editorPending: boolean;
  notice: ToastNotice | null;
  setFilter: (filter: TodoFilter) => void;
  openEditor: (itemId?: string) => void;
  closeEditor: () => void;
}

class TodoStoreState implements TodoState {
  items: TodoItem[] = [];
  status: LoadStatus = "idle";
  error = "";
  filter: TodoFilter = "open";
  editorOpen = false;
  editorItemId: string | null = null;
  pendingIds: string[] = [];
  quickPending = false;
  editorPending = false;
  notice: ToastNotice | null = null;

  readonly #setState: StoreApi<TodoState>["setState"];

  constructor(setState: StoreApi<TodoState>["setState"]) {
    this.#setState = setState;
  }

  setFilter = (filter: TodoFilter) => this.#setState({ filter });

  openEditor = (itemId?: string) => this.#setState({
    editorOpen: true,
    editorItemId: itemId ?? null,
  });

  closeEditor = () => this.#setState({ editorOpen: false, editorItemId: null });
}

export const useTodoStore = create<TodoState>((setState) => new TodoStoreState(setState));
