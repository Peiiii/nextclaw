import type { AgentRecord } from "@/types/agent.types.js";
import type { ContextRecord } from "@/types/context.types.js";
import type { SessionId } from "@/types/entity-ids.types.js";
import type { TaskRecord } from "@/types/task.types.js";
import type { SessionManager } from "@/managers/session.manager.js";

export class ContextBuilder {
  constructor(private readonly sessions: SessionManager) {}

  readonly build = (input: {
    sessionId: SessionId;
    task?: TaskRecord | null;
    agent: AgentRecord;
  }): ContextRecord => {
    // TODO(kernel):
    // 1. Resolve the session aggregate from SessionManager.
    // 2. Derive a run context from session/task/agent state.
    // 3. Return the assembled context snapshot without owning persistence.
    void this.sessions;
    void input;
    throw new Error("ContextBuilder.build is not implemented.");
  };
}
