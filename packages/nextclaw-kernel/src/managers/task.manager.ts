import type { AgentId, SessionId, TaskId } from "@/types/entity-ids.types.js";
import type { TaskRecord, TaskStatus } from "@/types/task.types.js";

export class TaskManager {
  readonly listTasks = () => {
    // TODO(kernel): return the current task registry snapshot.
    throw new Error("TaskManager.listTasks is not implemented.");
  };

  readonly getTask = (taskId: TaskId) => {
    // TODO(kernel): look up a task by id.
    void taskId;
    throw new Error("TaskManager.getTask is not implemented.");
  };

  readonly requireTask = (taskId: TaskId) => {
    // TODO(kernel): resolve a task and throw a domain error when missing.
    void taskId;
    throw new Error("TaskManager.requireTask is not implemented.");
  };

  readonly createTask = (input: {
    title: string;
    agentId: AgentId;
    sessionId: SessionId;
    input: unknown;
    metadata?: Record<string, unknown>;
  }) => {
    // TODO(kernel): create and persist a new task aggregate.
    void input;
    throw new Error("TaskManager.createTask is not implemented.");
  };

  readonly saveTask = (task: TaskRecord) => {
    // TODO(kernel): persist task state.
    void task;
    throw new Error("TaskManager.saveTask is not implemented.");
  };

  readonly updateTaskStatus = (taskId: TaskId, status: TaskStatus) => {
    // TODO(kernel): change task lifecycle state.
    void taskId;
    void status;
    throw new Error("TaskManager.updateTaskStatus is not implemented.");
  };

  readonly completeTask = (taskId: TaskId, output: unknown) => {
    // TODO(kernel): mark a task as completed and persist the output.
    void taskId;
    void output;
    throw new Error("TaskManager.completeTask is not implemented.");
  };

  readonly failTask = (taskId: TaskId, error: string) => {
    // TODO(kernel): mark a task as failed and persist the error payload.
    void taskId;
    void error;
    throw new Error("TaskManager.failTask is not implemented.");
  };

  readonly cancelTask = (taskId: TaskId) => {
    // TODO(kernel): cancel a task and reconcile the owning runtime state.
    void taskId;
    throw new Error("TaskManager.cancelTask is not implemented.");
  };
}
