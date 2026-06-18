import type { ChatSkillRecord } from '@/features/chat/types/chat-input-bar.types';
import type { PanelAppEntryView } from '@/shared/lib/api';

export type ChatInputProductPluginData = {
  isPanelAppsLoading: boolean;
  isSkillsLoading: boolean;
  panelApps: readonly PanelAppEntryView[];
  recentSkillValues: readonly string[];
  skillRecords: readonly ChatSkillRecord[];
};
