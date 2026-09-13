export type AgentIdentity = {
  id: string;
  publicKey: string;
  privateKeyFile: string;
};
export type TrustedAgent = {
  id: string;
  publicKey: string;
  account: string;
  controls?: boolean;
};
export type Actor = {
  account: string;
  agentId?: string;
  hop?: number;
  purpose?: "reply" | "status";
  operationId?: string;
  invalidAgent?: boolean;
};
export type CollaborationEvent = {
  specversion: "1.0";
  id: string;
  source: string;
  subject: string;
  type: string;
  time: string;
  data: {
    actor: Actor;
    body: string;
    resourceId: string;
    change: "message" | "context" | "closed" | "reopened";
    invited?: boolean;
  };
};
export type Conversation = {
  instructions?: string;
  subject: string;
  title: string;
  url: string;
  body: string;
  closed: boolean;
  invited: boolean;
  messages: Array<{ id: string; body: string; account: string }>;
};
export type SourceCheck = {
  source: string;
  account: string;
  writable: boolean;
  editableStatus: boolean;
};
export type SourceBatch = { events: CollaborationEvent[]; checkpoint: string };
export type OutputOperation = {
  id: string;
  subject: string;
  body: string;
  purpose: "reply" | "status";
  existingId?: string;
};
export interface SourceAdapter {
  readonly id: string;
  readonly maxMessageChars?: number;
  check(): Promise<SourceCheck>;
  collect(
    checkpoint: string | undefined,
    since: string,
    subjects: string[],
  ): Promise<SourceBatch>;
  readContext(subject: string): Promise<Conversation>;
  reply?(operation: OutputOperation): Promise<string>;
  findReply?(subject: string, operationId: string): Promise<string | undefined>;
}
export type ConsumerConfig =
  | { kind: "codex"; executable?: string; workspace: string }
  | { kind: "command"; command: string[]; workspace: string };
export type Connection = {
  id: string;
  adapter: string;
  options: Record<string, string>;
  agent: AgentIdentity;
  trustedAgents: TrustedAgent[];
  allowedAccounts: string[];
  consumer: ConsumerConfig;
  source: string;
  account: string;
  enabled: boolean;
  since: string;
  checkpoint?: string;
  intervalMs: number;
  maxAgentHops: number;
  maxRunsPerHour: number;
  lastScan?: string;
  error?: string;
};
export type ContextState = {
  key: string;
  connectionId: string;
  source: string;
  subject: string;
  agentId: string;
  title: string;
  url: string;
  threadId?: string;
  paused: boolean;
  closedPause?: boolean;
  inputDigest?: string;
  status: string;
  statusVersion?: number;
  statusMessageId?: string;
  statusPublished?: string;
  error?: string;
};
export type Execution = {
  requestId: string;
  threadId: string;
  turnId?: string;
};
export type ExecutionResult = {
  state: "running" | "completed" | "failed" | "cancelled" | "unknown";
  text?: string;
  error?: string;
};
export interface Consumer {
  create(title: string): Promise<string>;
  submit(
    threadId: string,
    requestId: string,
    prompt: string,
  ): Promise<Execution>;
  recover(threadId: string, requestId: string): Promise<Execution | undefined>;
  inspect(execution: Execution): Promise<ExecutionResult>;
  cancel(execution: Execution): Promise<void>;
  close(): Promise<void>;
}
export type Run = {
  id: string;
  contextKey: string;
  eventIds: string[];
  state:
    | "preparing"
    | "submitting"
    | "running"
    | "completed"
    | "failed"
    | "cancelled"
    | "unknown";
  createdAt: string;
  execution?: Execution;
  text?: string;
  error?: string;
  hop: number;
};
export type StoredEvent = {
  key: string;
  connectionId: string;
  event: CollaborationEvent;
  state: "pending" | "done" | "ignored";
  receivedAt: string;
};
export type OutboxEntry = {
  id: string;
  contextKey: string;
  operation: OutputOperation;
  state: "pending" | "sending" | "sent" | "unknown" | "superseded";
  statusValue?: string;
  messageId?: string;
  error?: string;
};
export type SourceFactory = (connection: Connection) => SourceAdapter;
