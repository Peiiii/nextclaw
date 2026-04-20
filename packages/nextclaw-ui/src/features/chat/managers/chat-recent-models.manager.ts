import { RecentSelectionManager } from '@/lib/recent-selection.manager';

export const chatRecentModelsManager = new RecentSelectionManager({
  storageKey: 'nextclaw.chat.recent-models',
  limit: 3
});

export const CHAT_RECENT_MODELS_MIN_OPTIONS = 5;
