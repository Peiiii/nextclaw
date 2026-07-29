import type { ChatSkillRecord } from '@/features/chat/types/chat-input-bar.types';
import type { PanelAppEntryView, ProjectView, ServerPathSearchEntryView } from '@/shared/lib/api';

export type ContextReferenceLocation =
  | { view: 'root' }
  | { view: 'files'; path: string }
  | { view: 'projects' };

export type ChatInputProductPluginData = {
  isPanelAppsLoading: boolean;
  isProjectsLoading: boolean;
  isServerPathSearchLoading: boolean;
  isSkillsLoading: boolean;
  panelApps: readonly PanelAppEntryView[];
  projectRoot: string;
  projects: readonly ProjectView[];
  projectsError: string | null;
  recentSkillValues: readonly string[];
  referenceLocation: ContextReferenceLocation;
  serverPathEntries: readonly ServerPathSearchEntryView[];
  serverPathSearchError: string | null;
  skillRecords: readonly ChatSkillRecord[];
};
