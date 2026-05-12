import { createAppEventKey } from "@nextclaw/shared";
import type {
  AgentMessageSentLifecycleEvent,
  AgentRunFinishedLifecycleEvent,
  AgentRunStartedLifecycleEvent,
  AgentSessionUpdatedLifecycleEvent,
} from "@kernel/types/ncp-lifecycle-event.types.js";

export const agentRunStartedLifecycleEventKey =
  createAppEventKey<AgentRunStartedLifecycleEvent>("agent.run.started");

export const agentRunFinishedLifecycleEventKey =
  createAppEventKey<AgentRunFinishedLifecycleEvent>("agent.run.finished");

export const agentMessageSentLifecycleEventKey =
  createAppEventKey<AgentMessageSentLifecycleEvent>("agent.message.sent");

export const agentSessionUpdatedLifecycleEventKey =
  createAppEventKey<AgentSessionUpdatedLifecycleEvent>("agent.session.updated");
