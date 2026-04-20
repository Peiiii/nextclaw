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
    void this.sessions;
    void input;
    throw new Error("ContextBuilder.build is not implemented.");
  };
}
