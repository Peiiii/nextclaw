import type { ChatSkillRecord } from '@/features/chat/types/chat-input-bar.types';
import type { PanelAppEntryView, ServerPathSearchEntryView } from '@/shared/lib/api';

export type ChatInputProductPluginData = {
  isPanelAppsLoading: boolean;
  isServerPathSearchLoading: boolean;
  isSkillsLoading: boolean;
  panelApps: readonly PanelAppEntryView[];
  projectRoot: string;
  recentSkillValues: readonly string[];
  referencePath: string | null;
  serverPathEntries: readonly ServerPathSearchEntryView[];
  serverPathSearchError: string | null;
  skillRecords: readonly ChatSkillRecord[];
};
