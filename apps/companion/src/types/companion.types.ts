export type CompanionAvatarView = {
  state: "running" | "idle" | "offline";
  title: string;
  subtitle: string;
  avatarUrl?: string;
  sessionId?: string;
  agentId?: string;
  openUrl: string;
};

export type CompanionOfflineReason = {
  summary: string;
};

export type CompanionAgentProfile = {
  id: string;
  displayName?: string;
  avatarUrl?: string;
};

export type CompanionSessionSummary = {
  sessionId: string;
  agentId?: string;
  updatedAt: string;
  messageCount: number;
  status?: "idle" | "running";
};
