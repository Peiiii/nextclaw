import type { Config, ThinkingLevel } from "@nextclaw/core";

type AgentModelsView = Config["agents"]["list"][number]["models"];

export type AgentProfileView = {
  id: string;
  default?: boolean;
  displayName?: string;
  description?: string;
  avatar?: string;
  avatarUrl?: string;
  workspace?: string;
  model?: string;
  runtime?: string;
  runtimeConfig?: Record<string, unknown> | null;
  engine?: string;
  engineConfig?: Record<string, unknown>;
  thinkingDefault?: ThinkingLevel;
  models?: AgentModelsView;
  contextTokens?: number;
  reservedContextTokens?: number;
  maxToolIterations?: number;
  builtIn?: boolean;
};

export type AgentCreateRequest = {
  id: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  home?: string;
  model?: string;
  runtime?: string;
  runtimeConfig?: Record<string, unknown> | null;
  contextTokens?: number | null;
};

export type AgentUpdateRequest = {
  displayName?: string;
  description?: string;
  avatar?: string;
  model?: string;
  runtime?: string;
  runtimeConfig?: Record<string, unknown> | null;
  contextTokens?: number | null;
};

export type AgentDeleteResult = {
  deleted: boolean;
  agentId: string;
};
