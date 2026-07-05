export type AgentCreateFormState = {
  id: string;
  displayName: string;
  description: string;
  avatar: string;
  home: string;
  model: string;
  runtime: string;
};

export type AgentAdvancedFormState = {
  contextTokens: string;
};

export type AgentEditFormState = {
  displayName: string;
  description: string;
  avatar: string;
  model: string;
  runtime: string;
} & AgentAdvancedFormState;
