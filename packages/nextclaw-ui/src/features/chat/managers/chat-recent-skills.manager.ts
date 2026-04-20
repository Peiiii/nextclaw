import { RecentSelectionManager } from '@/lib/recent-selection.manager';

export const chatRecentSkillsManager = new RecentSelectionManager({
  storageKey: 'nextclaw.chat.recent-skills',
  limit: 5
});

export const CHAT_RECENT_SKILLS_MIN_OPTIONS = 4;
