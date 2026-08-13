import { personalOrganizerService } from "@shared/services/personal-organizer.service";
import type { TodoDraft, TodoItem } from "@shared/types/personal-organizer.types";
import { getTodoGroup } from "@shared/utils/date.utils";
import type { StoreApi } from "zustand";
import type { TodoState } from "@/features/todos/stores/todo.store";

const sortTodos = (items: TodoItem[]): TodoItem[] => [...items].sort((left, right) => {
  const groupOrder = { overdue: 0, today: 1, upcoming: 2, anytime: 3, completed: 4 };
  const groupDifference = groupOrder[getTodoGroup(left)] - groupOrder[getTodoGroup(right)];
  if (groupDifference !== 0) return groupDifference;
  const leftDue = left.dueDate || "9999";
  const rightDue = right.dueDate || "9999";
  return leftDue.localeCompare(rightDue) || right.createdAt.localeCompare(left.createdAt);
});

export class TodoManager {
  constructor(private readonly store: StoreApi<TodoState>) {}

  load = async (): Promise<void> => {
    this.store.setState({ status: "loading", error: "" });
    try {
      const items = await personalOrganizerService.listTodos();
      this.store.setState({ items: sortTodos(items), status: "ready" });
    } catch (error) {
      this.store.setState({
        status: "error",
        error: error instanceof Error ? error.message : "暂时无法读取待办。",
      });
    }
  };

  createQuick = async (title: string): Promise<boolean> => {
    if (this.store.getState().quickPending) return false;
    this.store.setState({ quickPending: true });
    try {
      const item = await personalOrganizerService.createTodo({
        title,
        notes: "",
        dueDate: "",
        priority: "normal",
      });
      this.store.setState((state) => ({
        items: sortTodos([item, ...state.items]),
        quickPending: false,
        notice: { id: Date.now(), message: "已添加待办" },
      }));
      this.dismissNoticeLater();
      return true;
    } catch (error) {
      this.showError(error, "没有添加成功，请再试一次。");
      this.store.setState({ quickPending: false });
      return false;
    }
  };

  save = async (draft: TodoDraft, itemId?: string): Promise<boolean> => {
    if (this.store.getState().editorPending) return false;
    this.store.setState({ editorPending: true });
    try {
      const item = itemId
        ? await personalOrganizerService.updateTodo(itemId, draft)
        : await personalOrganizerService.createTodo(draft);
      this.store.setState((state) => ({
        items: sortTodos(itemId
          ? state.items.map((entry) => entry.id === item.id ? item : entry)
          : [item, ...state.items]),
        editorPending: false,
        editorOpen: false,
        editorItemId: null,
        notice: { id: Date.now(), message: itemId ? "待办已更新" : "待办已添加" },
      }));
      this.dismissNoticeLater();
      return true;
    } catch (error) {
      this.store.setState({ editorPending: false });
      this.showError(error, "没有保存成功，请检查后重试。");
      return false;
    }
  };

  toggleCompleted = async (item: TodoItem, completed: boolean): Promise<void> => {
    if (this.store.getState().pendingIds.includes(item.id)) return;
    this.store.setState((state) => ({
      items: sortTodos(state.items.map((entry) => entry.id === item.id ? { ...entry, completed } : entry)),
      pendingIds: [...state.pendingIds, item.id],
    }));
    try {
      const updated = await personalOrganizerService.updateTodo(item.id, { completed });
      this.store.setState((state) => ({
        items: sortTodos(state.items.map((entry) => entry.id === item.id ? updated : entry)),
        pendingIds: state.pendingIds.filter((id) => id !== item.id),
        notice: {
          id: Date.now(),
          message: completed ? "已完成一件事" : "已恢复为未完成",
          action: completed ? "undo-todo" : undefined,
          itemId: completed ? item.id : undefined,
        },
      }));
      this.dismissNoticeLater(completed ? 5_000 : 3_000);
    } catch (error) {
      this.store.setState((state) => ({
        items: sortTodos(state.items.map((entry) => entry.id === item.id ? item : entry)),
        pendingIds: state.pendingIds.filter((id) => id !== item.id),
      }));
      this.showError(error, "状态没有更新，请再试一次。");
    }
  };

  undoLastCompletion = async (): Promise<void> => {
    const notice = this.store.getState().notice;
    if (!notice?.itemId) return;
    const item = this.store.getState().items.find((entry) => entry.id === notice.itemId);
    this.store.setState({ notice: null });
    if (item) await this.toggleCompleted(item, false);
  };

  delete = async (itemId: string): Promise<boolean> => {
    if (this.store.getState().editorPending) return false;
    this.store.setState({ editorPending: true });
    try {
      await personalOrganizerService.deleteTodo(itemId);
      this.store.setState((state) => ({
        items: state.items.filter((item) => item.id !== itemId),
        editorPending: false,
        editorOpen: false,
        editorItemId: null,
        notice: { id: Date.now(), message: "待办已删除" },
      }));
      this.dismissNoticeLater();
      return true;
    } catch (error) {
      this.store.setState({ editorPending: false });
      this.showError(error, "没有删除成功，请再试一次。");
      return false;
    }
  };

  private showError = (error: unknown, fallback: string): void => {
    this.store.setState({
      notice: {
        id: Date.now(),
        message: error instanceof Error ? error.message : fallback,
        tone: "error",
      },
    });
    this.dismissNoticeLater(5_000);
  };

  private dismissNoticeLater = (delay = 3_000): void => {
    const noticeId = this.store.getState().notice?.id;
    window.setTimeout(() => {
      if (this.store.getState().notice?.id === noticeId) this.store.setState({ notice: null });
    }, delay);
  };
}
