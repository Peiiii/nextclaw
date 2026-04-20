import type { AgentId, AutomationId, SessionId } from "./entity-ids.types.js";

export type AutomationTrigger =
  | { kind: "cron"; expression: string }
  | { kind: "manual" }
  | { kind: "event"; event: string };

export type AutomationRecord = {
  id: AutomationId;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  agentId: AgentId;
  sessionId?: SessionId | null;
  inputTemplate?: unknown;
  metadata: Record<string, unknown>;
};
