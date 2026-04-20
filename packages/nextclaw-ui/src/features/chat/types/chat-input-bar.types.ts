export type ChatThinkingLevel =
  | "off"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "adaptive"
  | "xhigh";

export type ChatSkillRecord = {
  key: string;
  label: string;
  scopeLabel?: string;
  description?: string;
  descriptionZh?: string;
  badgeLabel?: string;
};

export type ChatModelRecord = {
  value: string;
  modelLabel: string;
  providerLabel: string;
  thinkingCapability?: {
    supported: ChatThinkingLevel[];
    default?: ChatThinkingLevel | null;
  } | null;
};

export type ChatInputBarAdapterTexts = {
  slashSkillSubtitle: string;
  slashSkillSpecLabel: string;
  slashSkillScopeLabel: string;
  noSkillDescription: string;
  recentSkillsLabel: string;
  allSkillsLabel: string;
  modelSelectPlaceholder: string;
  modelNoOptionsLabel: string;
  recentModelsLabel: string;
  allModelsLabel: string;
  sessionTypePlaceholder: string;
  thinkingLabels: Record<ChatThinkingLevel, string>;
  noModelOptionsLabel: string;
  configureProviderLabel: string;
};
