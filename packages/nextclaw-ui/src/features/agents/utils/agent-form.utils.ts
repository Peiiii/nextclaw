import type { AgentProfileView } from "@/shared/lib/api";
import type {
  AgentCreateFormState,
  AgentEditFormState,
} from "@/features/agents/types/agent-form.types";

export const EMPTY_AGENT_CREATE_FORM: AgentCreateFormState = {
  id: "",
  displayName: "",
  description: "",
  avatar: "",
  model: "",
  home: "",
  runtime: "",
};

export const EMPTY_AGENT_EDIT_FORM: AgentEditFormState = {
  displayName: "",
  description: "",
  avatar: "",
  model: "",
  runtime: "",
  contextTokens: "",
};

export function toAgentEditFormState(agent: AgentProfileView): AgentEditFormState {
  return {
    displayName: agent.displayName ?? "",
    description: agent.description ?? "",
    avatar: agent.avatar ?? "",
    model: agent.model ?? "",
    runtime: agent.runtime ?? agent.engine ?? "",
    contextTokens: formatOptionalNumberField(agent.contextTokens),
  };
}

function formatOptionalNumberField(value: number | undefined): string {
  return typeof value === "number" ? String(value) : "";
}
