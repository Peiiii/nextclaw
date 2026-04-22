import type { ChannelSpecView } from '@/shared/lib/api';
import { getLanguage } from '@/shared/lib/i18n';

export function resolveChannelTutorialUrl(channel: Pick<ChannelSpecView, 'tutorialUrl' | 'tutorialUrls'>): string | undefined {
  const lang = getLanguage();
  const localized = channel.tutorialUrls?.[lang];
  return localized || channel.tutorialUrls?.default || channel.tutorialUrl;
}
