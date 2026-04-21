import type { ChannelSpecView } from '@/api/types';
import { getLanguage } from '@/lib/i18n';

export function resolveChannelTutorialUrl(channel: Pick<ChannelSpecView, 'tutorialUrl' | 'tutorialUrls'>): string | undefined {
  const lang = getLanguage();
  const localized = channel.tutorialUrls?.[lang];
  return localized || channel.tutorialUrls?.default || channel.tutorialUrl;
}
