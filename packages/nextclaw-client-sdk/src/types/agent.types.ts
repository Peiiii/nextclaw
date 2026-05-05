export type NextClawAgentProfile = {
  id: string;
  default?: boolean;
  displayName?: string;
  description?: string;
  avatar?: string;
  avatarUrl?: string;
  workspace?: string;
  model?: string;
  runtime?: string;
  runtimeConfig?: Record<string, unknown>;
  engine?: string;
  engineConfig?: Record<string, unknown>;
  contextTokens?: number;
  maxToolIterations?: number;
  builtIn?: boolean;
};

export type NextClawAgentList = {
  agents: NextClawAgentProfile[];
};
