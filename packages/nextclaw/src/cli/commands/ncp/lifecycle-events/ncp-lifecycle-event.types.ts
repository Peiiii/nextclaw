export type AgentLifecycleSessionContext = {
  sessionId: string;
  sessionType?: string;
  parentSessionId?: string;
  isChildSession: boolean;
  emittedAt: string;
};

export type AgentRunStartedLifecycleEvent = AgentLifecycleSessionContext & {
  runId?: string;
  messageId?: string;
};

export type AgentRunFinishedLifecycleEvent = AgentLifecycleSessionContext & {
  runId?: string;
  messageId?: string;
};

export type AgentMessageSentLifecycleEvent = AgentLifecycleSessionContext & {
  messageId: string;
  role: string;
};

export type AgentSessionUpdatedLifecycleEvent = AgentLifecycleSessionContext;
