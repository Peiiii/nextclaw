export type ChatSessionTypeIconView = {
  kind: "image";
  src: string;
  alt?: string | null;
};

export type ChatSessionTypeCtaView = {
  kind: string;
  label?: string;
  href?: string;
};

export type ChatSessionTypeOptionView = {
  value: string;
  label: string;
  icon?: ChatSessionTypeIconView | null;
  ready?: boolean;
  reason?: string | null;
  reasonMessage?: string | null;
  supportedModels?: string[];
  recommendedModel?: string | null;
  cta?: ChatSessionTypeCtaView | null;
};

export type ChatSessionTypesView = {
  defaultType: string;
  options: ChatSessionTypeOptionView[];
};
