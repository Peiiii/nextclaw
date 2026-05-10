import type { AgentRecord } from "@kernel/types/agent.types.js";
import type { ContextRecord } from "@kernel/types/context.types.js";
import type { SessionId } from "@kernel/types/entity-ids.types.js";
import type { TaskRecord } from "@kernel/types/task.types.js";
import type { SessionManager } from "@nextclaw/core";

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
