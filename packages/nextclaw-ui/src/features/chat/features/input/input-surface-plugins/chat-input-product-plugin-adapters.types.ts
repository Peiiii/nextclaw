import type { ChatSkillRecord } from '@/features/chat/types/chat-input-bar.types';
import type { PanelAppEntryView, ProjectView, ServerPathSearchEntryView, SystemObjectReferenceGroupView } from '@/shared/lib/api';

export type ContextReferenceLocation =
  | { view: 'root' }
  | { view: 'files'; path: string }
  | { view: 'folders'; path: string }
  | { view: 'projects' }
  | { view: 'system-objects'; objectType: string };

export type ChatInputProductPluginData = {
  isPanelAppsLoading: boolean;
  isProjectsLoading: boolean;
  isServerPathSearchLoading: boolean;
  isSkillsLoading: boolean;
  isSystemObjectsLoading?: boolean;
  panelApps: readonly PanelAppEntryView[];
  projectRoot: string;
  projects: readonly ProjectView[];
  projectsError: string | null;
  recentSkillValues: readonly string[];
  referenceLocation: ContextReferenceLocation;
  serverPathEntries: readonly ServerPathSearchEntryView[];
  serverPathSearchError: string | null;
  skillRecords: readonly ChatSkillRecord[];
  systemObjectGroups?: readonly SystemObjectReferenceGroupView[];
  systemObjectsError?: string | null;
};
