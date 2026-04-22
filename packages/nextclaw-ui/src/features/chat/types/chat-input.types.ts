import type { ThinkingLevel } from '@/shared/lib/api';

export type ChatModelThinkingCapability = {
  supported: ThinkingLevel[];
  default?: ThinkingLevel | null;
};

export type ChatModelOption = {
  value: string;
  modelLabel: string;
  providerLabel: string;
  thinkingCapability?: ChatModelThinkingCapability | null;
};

export type ChatInputBarSlashItem = {
  kind: 'skill';
  key: string;
  title: string;
  subtitle: string;
  description: string;
  detailLines: string[];
  skillSpec?: string;
};
