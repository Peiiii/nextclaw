export type SessionListRecord = {
  key: string;
  created_at: string;
  updated_at: string;
  path: string;
  agentId?: string;
  messageCount?: number;
  lastMessageAt?: string;
  metadata: Record<string, unknown>;
};
