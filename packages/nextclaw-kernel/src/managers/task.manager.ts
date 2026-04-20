import type { AgentId, SessionId, TaskId } from "@/types/entity-ids.types.js";
import type { TaskRecord, TaskStatus } from "@/types/task.types.js";

export abstract class TaskManager {
  abstract listTasks(): TaskRecord[];
  abstract getTask(taskId: TaskId): TaskRecord | null;
  abstract requireTask(taskId: TaskId): TaskRecord;
  abstract createTask(input: {
    title: string;
    agentId: AgentId;
    sessionId: SessionId;
    input: unknown;
    metadata?: Record<string, unknown>;
  }): TaskRecord;
  abstract saveTask(task: TaskRecord): void;
  abstract updateTaskStatus(taskId: TaskId, status: TaskStatus): TaskRecord;
  abstract completeTask(taskId: TaskId, output: unknown): TaskRecord;
  abstract failTask(taskId: TaskId, error: string): TaskRecord;
  abstract cancelTask(taskId: TaskId): TaskRecord;
}
