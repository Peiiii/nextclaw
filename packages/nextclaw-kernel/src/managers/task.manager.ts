import type { AgentId, SessionId, TaskId } from "@/types/entity-ids.types.js";
import type { TaskRecord, TaskStatus } from "@/types/task.types.js";

export class TaskManager {
  readonly listTasks = () => {
    throw new Error("TaskManager.listTasks is not implemented.");
  };

  readonly getTask = (taskId: TaskId) => {
    void taskId;
    throw new Error("TaskManager.getTask is not implemented.");
  };

  readonly requireTask = (taskId: TaskId) => {
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
    void input;
    throw new Error("TaskManager.createTask is not implemented.");
  };

  readonly saveTask = (task: TaskRecord) => {
    void task;
    throw new Error("TaskManager.saveTask is not implemented.");
  };

  readonly updateTaskStatus = (taskId: TaskId, status: TaskStatus) => {
    void taskId;
    void status;
    throw new Error("TaskManager.updateTaskStatus is not implemented.");
  };

  readonly completeTask = (taskId: TaskId, output: unknown) => {
    void taskId;
    void output;
    throw new Error("TaskManager.completeTask is not implemented.");
  };

  readonly failTask = (taskId: TaskId, error: string) => {
    void taskId;
    void error;
    throw new Error("TaskManager.failTask is not implemented.");
  };

  readonly cancelTask = (taskId: TaskId) => {
    void taskId;
    throw new Error("TaskManager.cancelTask is not implemented.");
  };
}
