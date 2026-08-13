import { TodoManager } from "@/features/todos/managers/todo.manager";
import { useTodoStore } from "@/features/todos/stores/todo.store";

class TodosPresenter {
  readonly manager = new TodoManager(useTodoStore);
}

export const todosPresenter = new TodosPresenter();
