import type { AgentRecord } from "@/types/agent.types.js";
import type { ContextRecord } from "@/types/context.types.js";
import type { SessionId } from "@/types/entity-ids.types.js";
import type { SessionRecord } from "@/types/session.types.js";
import type { TaskRecord } from "@/types/task.types.js";

export abstract class ContextManager {
  abstract getContext(sessionId: SessionId): ContextRecord | null;
  abstract requireContext(sessionId: SessionId): ContextRecord;
  abstract saveContext(context: ContextRecord): void;
  abstract assembleContext(input: {
    session: SessionRecord;
    task?: TaskRecord | null;
    agent: AgentRecord;
  }): ContextRecord;
  abstract patchContext(sessionId: SessionId, patch: Partial<ContextRecord>): ContextRecord;
}
