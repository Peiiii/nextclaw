import { createTypedEventKey } from "@nextclaw/core";
import type {
  AgentMessageSentLifecycleEvent,
  AgentRunFinishedLifecycleEvent,
  AgentRunStartedLifecycleEvent,
  AgentSessionUpdatedLifecycleEvent,
} from "./ncp-lifecycle-event.types.js";

export const agentRunStartedLifecycleEventKey =
  createTypedEventKey<AgentRunStartedLifecycleEvent>("agent.run.started");

export const agentRunFinishedLifecycleEventKey =
  createTypedEventKey<AgentRunFinishedLifecycleEvent>("agent.run.finished");

export const agentMessageSentLifecycleEventKey =
  createTypedEventKey<AgentMessageSentLifecycleEvent>("agent.message.sent");

export const agentSessionUpdatedLifecycleEventKey =
  createTypedEventKey<AgentSessionUpdatedLifecycleEvent>("agent.session.updated");
