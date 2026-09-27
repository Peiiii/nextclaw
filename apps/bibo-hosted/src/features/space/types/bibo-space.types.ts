import type { BiboTask } from "@nextclaw/bibo-client";

export type Page<T> = { items: T[]; nextCursor: string | null };
export type FileDraft = { content: string; version: number; dirty: boolean; saving: boolean; conflict?: boolean; error?: string };
export type TaskDraft = Pick<BiboTask, "title" | "description" | "status" | "priority" | "subtasks"> & { projectId: string; startAt: string; dueAt: string; version: number | null };
export type EventDraft = { title: string; description: string; startAt: string; endAt: string; version: number | null };
