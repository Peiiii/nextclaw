import type { ThinkingLevel } from '@/api/types';

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
